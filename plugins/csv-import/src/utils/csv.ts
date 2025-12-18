import {
    Collection,
    CollectionItem,
    type CollectionItemInput,
    type Field,
    type FieldDataEntryInput,
    type FieldDataInput,
    framer,
} from "framer-plugin"

import * as v from "valibot"
import { type FieldReconciliationItem, getMappedFieldName } from "./fieldReconciliation"
import type { InferredField } from "./typeInference"

const CSVRecordSchema = v.record(v.string(), v.string())

type CSVRecord = v.InferOutput<typeof CSVRecordSchema>

export type ImportResultItem = CollectionItemInput & {
    action: "add" | "conflict" | "onConflictUpdate" | "onConflictSkip"
}

export interface ImportResult {
    warnings: {
        missingSlugCount: number
        doubleSlugCount: number
        skippedValueCount: number
        skippedValueKeys: Set<string>
    }
    items: ImportResultItem[]
}

/**
 * Parses a string of CSV data. Does not do any type casting, because we want to
 * apply that based on the fields the data will go into, not the data itself.
 *
 * @param data CSV data, separated by comma or tab.
 * @returns Array of parsed records
 */
export async function parseCSV(data: string): Promise<CSVRecord[]> {
    // Lazily import the parser
    const { parse } = await import("csv-parse/browser/esm/sync")

    let records: CSVRecord[] = []
    let error

    // Delimiters to try
    // ,  = pretty much the default
    // \t = more common when copy-pasting (e.g. Google Sheets)
    // ;  = what spreadsheet apps (e.g. Numbers) use when you're using a locale
    //      that already uses , for decimal separation
    // Check of , and \t will be combined as this will cover most cases, falls back to ;
    const delimiters = [",", "\t", ";"]
    const options = { columns: true, skipEmptyLines: true, skipRecordsWithEmptyValues: true }

    for (const delimiter of delimiters) {
        try {
            const parsed = parse(data, { ...options, delimiter }) as unknown

            // It can happen that parsing succeeds with the wrong delimiter. For example, a tab separated file could be parsed
            // successfully with comma separators. If that's the case, we can find it by checking two things:
            // 1. That the resulting records have more than one column
            // 2. That if there's only one column, it does not contain delimiters
            // If both of those conditions are met, we can assume there's a parsing error and should not import the records
            const firstItemKeys = isArray(parsed) && parsed[0] && isObject(parsed[0]) ? Object.keys(parsed[0]) : []
            if (firstItemKeys.length < 2) {
                const delimiterInKey = delimiters.some(del => firstItemKeys[0]?.includes(del))
                if (delimiterInKey) {
                    error = new Error("Parsed with incorrect delimiter")
                    continue
                }
            }

            error = undefined
            records = v.parse(v.array(CSVRecordSchema), parsed)
            break
        } catch (innerError) {
            error = innerError instanceof Error ? innerError : new Error(String(innerError))
        }
    }

    if (error) {
        throw error
    }

    return records
}

/** Error when importing fails, internal to `RecordImporter` */
export class ImportError extends Error {
    /**
     * @param variant Notification variant to show the user
     * @param message Message to show the user
     */
    constructor(
        readonly variant?: "error" | "warning",
        message?: string
    ) {
        super(message)
    }
}

/** Used to indicated a value conversion failed, used by `RecordImporter` and `setValueForVariable` */
class ConversionError extends Error {}

function findRecordValue(record: CSVRecord, key: string) {
    const value = Object.entries(record).find(([k]) => collator.compare(k, key) === 0)?.[1]
    if (!value) {
        return null
    }
    return value
}

const collator = new Intl.Collator("en", { sensitivity: "base" })
const BOOLEAN_TRUTHY_VALUES = /1|y(?:es)?|true/iu

interface GetFieldDataEntryInputForFieldOpts {
    field: Field
    value: string | null
    allItemIdBySlug: Map<string, Map<string, string>>
    csvRecord: CSVRecord
}

function getFieldDataEntryInputForField(opts: GetFieldDataEntryInputForFieldOpts): FieldDataEntryInput | ConversionError {
    switch (opts.field.type) {
        case "string":
            return { type: opts.field.type, value: opts.value ?? "" }
        case "formattedText":
            return { type: opts.field.type, value: opts.value ?? "", contentType: "auto" }

        case "color":
        case "link":
        case "file":
            return { type: opts.field.type, value: opts.value ? opts.value.trim() : null }

        case "image": {
            const altText = findRecordValue(opts.csvRecord, `${opts.field.name}:alt`)
            return { type: opts.field.type, value: opts.value ? opts.value.trim() : null, alt: altText ?? undefined }
        }

        case "number": {
            const number = Number(opts.value)
            if (Number.isNaN(number)) {
                return new ConversionError(`Invalid value for field “${opts.field.name}” expected a number`)
            }
            return { type: "number", value: number }
        }

        case "boolean": {
            return { type: "boolean", value: opts.value ? BOOLEAN_TRUTHY_VALUES.test(opts.value) : false }
        }

        case "date": {
            if (opts.value === null) {
                return { type: "date", value: null }
            }
            const date = new Date(opts.value)
            if (!isValidDate(date)) {
                return new ConversionError(`Invalid value for field “${opts.field.name}” expected a valid date`)
            }
            return { type: "date", value: date.toJSON() }
        }

        case "enum": {
            if (opts.value === null) {
                const [firstCase] = opts.field.cases
                assert(firstCase, `No cases found for enum “${opts.field.name}”`)
                return { type: "enum", value: firstCase.id }
            }
            const matchingCase = opts.field.cases.find(
                enumCase => collator.compare(enumCase.name, opts.value!) === 0 || enumCase.id === opts.value
            )
            if (!matchingCase) {
                return new ConversionError(`Invalid case “${opts.value}” for enum “${opts.field.name}”`)
            }
            return { type: "enum", value: matchingCase.id }
        }

        case "collectionReference": {
            if (opts.value === null) {
                return { type: "collectionReference", value: null }
            }

            const referencedSlug = opts.value.trim()
            const referencedId = opts.allItemIdBySlug.get(opts.field.collectionId)?.get(referencedSlug)
            if (!referencedId) {
                return new ConversionError(`Invalid Collection reference “${opts.value}”`)
            }

            return { type: "collectionReference", value: referencedId }
        }

        case "multiCollectionReference": {
            if (opts.value === null) {
                return { type: "multiCollectionReference", value: null }
            }
            const referencedSlugs = opts.value.split(",").map(slug => slug.trim())
            const referencedIds: string[] = []

            for (const slug of referencedSlugs) {
                const referencedId = opts.allItemIdBySlug.get(opts.field.collectionId)?.get(slug)
                if (!referencedId) {
                    return new ConversionError(`Invalid Collection reference “${slug}”`)
                }
                referencedIds.push(referencedId)
            }

            return { type: "multiCollectionReference", value: referencedIds }
        }

        case "array":
        case "divider":
        case "unsupported":
            return new ConversionError(`Unsupported field type “${opts.field.type}”`)

        default:
            opts.field satisfies never
            return new ConversionError("This should not happen")
    }
}

function getFirstMatchingIndex(values: string[], name: string | undefined) {
    if (!name) {
        return -1
    }

    for (const [index, value] of values.entries()) {
        if (collator.compare(value, name) === 0) {
            return index
        }
    }

    return -1
}

interface FindSlugFieldIndexOpts {
    csvHeader: string[]
    slugField: { name: string; basedOn?: string | null }
    collectionFields: Field[]
}

/**
 * Find the index of the slug field in the CSV header
 * Either matches the slug field directly or finds the field it's based on
 */
function findSlugFieldIndex(opts: FindSlugFieldIndexOpts): { slugIndex: number; basedOnIndex: number } {
    // Try direct match first
    const slugIndex = getFirstMatchingIndex(opts.csvHeader, opts.slugField.name)

    // Find the based on field
    const basedOnField = opts.collectionFields.find(field => field.id === opts.slugField.basedOn)
    const basedOnIndex = getFirstMatchingIndex(opts.csvHeader, basedOnField?.name)

    // If neither field is found, throw error
    if (slugIndex === -1 && basedOnIndex === -1) {
        throw new ImportError("error", `Import failed. Ensure your CSV has a column named “${opts.slugField.name}”.`)
    }

    return { slugIndex, basedOnIndex }
}

/** Importer for "records": string based values with named keys */
export async function processRecords(collection: Collection, records: CSVRecord[]) {
    if (!collection.slugFieldName) {
        throw new ImportError("error", "Import failed. No slug field was found in your CMS Collection.")
    }

    const existingItems = await collection.getItems()

    const result: ImportResult = {
        warnings: {
            missingSlugCount: 0,
            doubleSlugCount: 0,
            skippedValueCount: 0,
            skippedValueKeys: new Set<string>(),
        },
        items: [],
    }

    const fields = await collection.getFields()
    const allItemIdBySlug = new Map<string, Map<string, string>>()

    const firstRecord = records[0]
    assert(firstRecord, "No records were found in your CSV.")

    const csvHeader = Object.keys(firstRecord)
    const { slugIndex, basedOnIndex } = findSlugFieldIndex({
        csvHeader,
        slugField: {
            name: collection.slugFieldName,
            basedOn: collection.slugFieldBasedOn,
        },
        collectionFields: fields,
    })

    // Check if CSV has a draft column
    const hasDraftColumn = csvHeader.includes(":draft")

    for (const field of fields) {
        if (field.type === "collectionReference" || field.type === "multiCollectionReference") {
            const collectionIdBySlug = allItemIdBySlug.get(field.collectionId) ?? new Map<string, string>()

            const collection = await framer.getCollection(field.collectionId)
            if (!collection) {
                throw new ImportError(
                    "error",
                    `Import failed. “${field.name}” references a Collection that doesn’t exist.`
                )
            }

            const items = await collection.getItems()
            for (const item of items) {
                collectionIdBySlug.set(item.slug, item.id)
            }

            allItemIdBySlug.set(field.collectionId, collectionIdBySlug)
        }
    }

    const newSlugValues = new Set<string>()
    const existingItemsBySlug = new Map<string, CollectionItem>()
    for (const item of existingItems) {
        existingItemsBySlug.set(item.slug, item)
    }

    const fieldsToImport = fields.filter(field => csvHeader.find(header => collator.compare(header, field.name) === 0))

    for (const record of records) {
        let slug: string | undefined
        const values = Object.values(record)

        // Try to get slug from the slug field first
        if (slugIndex !== -1 && !isUndefined(values[slugIndex])) {
            slug = slugify(values[slugIndex])
        }

        // If no slug and we have a basedOn field, try to get slug from that
        if (!slug && basedOnIndex !== -1 && !isUndefined(values[basedOnIndex])) {
            slug = slugify(values[basedOnIndex])
        }

        if (!slug) {
            result.warnings.missingSlugCount++
            continue
        } else if (newSlugValues.has(slug)) {
            result.warnings.doubleSlugCount++
            continue
        }

        // Parse draft status
        let draft = false
        if (hasDraftColumn) {
            const draftValue = findRecordValue(record, ":draft")
            if (draftValue && draftValue.trim() !== "") {
                draft = BOOLEAN_TRUTHY_VALUES.test(draftValue.trim())
            }
        }

        const fieldData: FieldDataInput = {}
        for (const field of fieldsToImport) {
            const value = findRecordValue(record, field.name)
            const fieldDataEntry = getFieldDataEntryInputForField({ field, value, allItemIdBySlug, csvRecord: record })

            if (fieldDataEntry instanceof ConversionError) {
                result.warnings.skippedValueCount++
                result.warnings.skippedValueKeys.add(field.name)
                continue
            }

            fieldData[field.id] = fieldDataEntry
        }

        const item: ImportResultItem = {
            id: existingItemsBySlug.get(slug)?.id,
            slug,
            fieldData,
            action: existingItemsBySlug.get(slug) ? "conflict" : "add",
            draft,
        }

        if (item.action === "add") {
            newSlugValues.add(slug)
        }

        result.items.push(item)
    }

    return result
}

/**
 * Process CSV records with custom field mapping
 * This version maps CSV columns to existing collection fields by name
 */
export interface ProcessRecordsWithFieldMappingOpts {
    collection: Collection
    csvRecords: CSVRecord[]
    inferredFields: InferredField[]
    ignoredFieldNames: Set<string>
    slugFieldName: string
    reconciliation?: FieldReconciliationItem[]
}

export async function processRecordsWithFieldMapping(
    opts: ProcessRecordsWithFieldMappingOpts
): Promise<ImportResult> {
    if (!opts.collection.slugFieldName) {
        throw new ImportError("error", "Import failed. No slug field was found in your CMS Collection.")
    }

    const existingItems = await opts.collection.getItems()

    const result: ImportResult = {
        warnings: {
            missingSlugCount: 0,
            doubleSlugCount: 0,
            skippedValueCount: 0,
            skippedValueKeys: new Set<string>(),
        },
        items: [],
    }

    // Create field mapping from inferred fields to CSV column names
    const csvToFieldMapping = new Map<string, string>()

    // Get collection fields (may have been updated by reconciliation)
    const fields = await opts.collection.getFields()

    for (const field of opts.inferredFields) {
        if (!opts.ignoredFieldNames.has(field.columnName)) {
            // If we have reconciliation data, use it to determine the mapping
            if (opts.reconciliation) {
                const mappedName = getMappedFieldName({ csvColumnName: field.columnName, reconciliation: opts.reconciliation, collectionFields: fields })
                if (mappedName) {
                    csvToFieldMapping.set(field.columnName, mappedName)
                }
            } else {
                // Fallback to original behavior
                csvToFieldMapping.set(field.columnName, field.name || field.columnName)
            }
        }
    }

    const allItemIdBySlug = new Map<string, Map<string, string>>()

    // Build reference maps for collection reference fields
    for (const field of fields) {
        if (field.type === "collectionReference" || field.type === "multiCollectionReference") {
            const collectionIdBySlug = allItemIdBySlug.get(field.collectionId) ?? new Map<string, string>()

            const referencedCollection = await framer.getCollection(field.collectionId)
            if (!referencedCollection) {
                throw new ImportError(
                    "error",
                    `Import failed. "${field.name}" references a Collection that doesn't exist.`
                )
            }

            const items = await referencedCollection.getItems()
            for (const item of items) {
                collectionIdBySlug.set(item.slug, item.id)
            }

            allItemIdBySlug.set(field.collectionId, collectionIdBySlug)
        }
    }

    // Check if CSV has a draft column
    const firstRecord = opts.csvRecords[0]
    assert(firstRecord, "No records were found in your CSV.")
    const csvHeader = Object.keys(firstRecord)
    const hasDraftColumn = csvHeader.includes(":draft")

    const newSlugValues = new Set<string>()
    const existingItemsBySlug = new Map<string, CollectionItem>()
    for (const item of existingItems) {
        existingItemsBySlug.set(item.slug, item)
    }

    // Find fields to import based on mapping
    const fieldsToImport = fields.filter(field => {
        // Check if any CSV column maps to this field name
        for (const [, mappedName] of csvToFieldMapping) {
            if (collator.compare(mappedName, field.name) === 0) {
                return true
            }
        }
        return false
    })

    for (const record of opts.csvRecords) {
        // Get slug value
        const slugValue = findRecordValue(record, opts.slugFieldName)
        if (!slugValue || slugValue.trim() === "") {
            result.warnings.missingSlugCount++
            continue
        }

        const slug = slugify(slugValue)
        if (newSlugValues.has(slug)) {
            result.warnings.doubleSlugCount++
            continue
        }

        // Parse draft status
        let draft = false
        if (hasDraftColumn) {
            const draftValue = findRecordValue(record, ":draft")
            if (draftValue && draftValue.trim() !== "") {
                draft = BOOLEAN_TRUTHY_VALUES.test(draftValue.trim())
            }
        }

        const fieldData: FieldDataInput = {}
        for (const field of fieldsToImport) {
            // Find the CSV column that maps to this field
            let csvColumnName: string | undefined
            for (const [csvColumn, mappedName] of csvToFieldMapping) {
                if (collator.compare(mappedName, field.name) === 0) {
                    csvColumnName = csvColumn
                    break
                }
            }

            if (!csvColumnName) continue

            const value = findRecordValue(record, csvColumnName)
            const fieldDataEntry = getFieldDataEntryInputForField({ field, value, allItemIdBySlug, csvRecord: record })

            if (fieldDataEntry instanceof ConversionError) {
                result.warnings.skippedValueCount++
                result.warnings.skippedValueKeys.add(field.name)
                continue
            }

            fieldData[field.id] = fieldDataEntry
        }

        const item: ImportResultItem = {
            id: existingItemsBySlug.get(slug)?.id,
            slug,
            fieldData,
            action: existingItemsBySlug.get(slug) ? "conflict" : "add",
            draft,
        }

        if (item.action === "add") {
            newSlugValues.add(slug)
        }

        result.items.push(item)
    }

    return result
}

export async function importCSV(collection: Collection, result: ImportResult) {
    const totalItems = result.items.length
    const totalAdded = result.items.filter(item => item.action === "add").length
    const totalUpdated = result.items.filter(item => item.action === "onConflictUpdate").length
    const totalSkipped = result.items.filter(item => item.action === "onConflictSkip").length
    if (totalItems !== totalAdded + totalUpdated + totalSkipped) {
        throw new Error("Total items mismatch")
    }

    await collection.addItems(
        result.items
            .filter(item => item.action !== "onConflictSkip")
            .map(item => {
                if (item.action === "add") {
                    assert(item.slug !== undefined, "Item requires a slug")
                    return {
                        slug: item.slug,
                        fieldData: item.fieldData,
                        draft: item.draft,
                    }
                }

                assert(item.id !== undefined, "Item requires an id")
                return {
                    id: item.id,
                    fieldData: item.fieldData,
                    draft: item.draft,
                }
            })
    )

    const messages: string[] = []
    if (totalAdded > 0) {
        messages.push(`Added ${totalAdded} ${totalAdded === 1 ? "item" : "items"}`)
    }
    if (totalUpdated > 0) {
        messages.push(`Updated ${totalUpdated} ${totalUpdated === 1 ? "item" : "items"}`)
    }
    if (totalSkipped > 0) {
        messages.push(`Skipped ${totalSkipped} ${totalSkipped === 1 ? "item" : "items"}`)
    }

    if (result.warnings.missingSlugCount > 0) {
        messages.push(
            `Skipped ${result.warnings.missingSlugCount} ${
                result.warnings.missingSlugCount === 1 ? "item" : "items"
            } because of missing slug field`
        )
    }
    if (result.warnings.doubleSlugCount > 0) {
        messages.push(
            `Skipped ${result.warnings.doubleSlugCount} ${
                result.warnings.doubleSlugCount === 1 ? "item" : "items"
            } because of duplicate slugs`
        )
    }

    const { skippedValueCount, skippedValueKeys } = result.warnings
    if (skippedValueCount > 0) {
        messages.push(
            `Skipped ${skippedValueCount} ${skippedValueCount === 1 ? "value" : "values"} for ${
                skippedValueKeys.size
            } ${skippedValueKeys.size === 1 ? "field" : "fields"} (${summary([...skippedValueKeys], 3)})`
        )
    }

    const finalMessage = messages.join(". ")
    framer.closePlugin(messages.length > 1 ? finalMessage + "." : finalMessage || "Successfully imported Collection")
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value)
}

function isValidDate(date: Date): boolean {
    return !Number.isNaN(date.getTime())
}

/** Helper to show a summary of items, truncating after `max` */
function summary(items: string[], max: number) {
    const summaryFormatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" })

    if (items.length === 0) {
        return "none"
    }
    // Go one past the max, because we'll add a sentinel anyway
    if (items.length > max + 1) {
        items = items.slice(0, max).concat([`${items.length - max} more`])
    }
    return summaryFormatter.format(items)
}

// Match everything except for letters, numbers and parentheses.
const nonSlugCharactersRegExp = /[^\p{Letter}\p{Number}()]+/gu
// Match leading/trailing dashes, for trimming purposes.
const trimSlugRegExp = /^-+|-+$/gu

/**
 * Takes a freeform string and removes all characters except letters, numbers,
 * and parentheses. Also makes it lower case, and separates words by dashes.
 * This makes the value URL safe.
 */
export function slugify(value: string): string {
    return value.toLowerCase().replace(nonSlugCharactersRegExp, "-").replace(trimSlugRegExp, "")
}

function assert(condition: unknown, ...msg: unknown[]): asserts condition {
    if (condition) return

    const e = Error("Assertion Error" + (msg.length > 0 ? ": " + msg.join(" ") : ""))
    // Hack the stack so the assert call itself disappears. Works in jest and in chrome.
    if (e.stack) {
        try {
            const lines = e.stack.split("\n")
            if (lines[1]?.includes("assert")) {
                lines.splice(1, 1)
                e.stack = lines.join("\n")
            } else if (lines[0]?.includes("assert")) {
                lines.splice(0, 1)
                e.stack = lines.join("\n")
            }
        } catch {
            // nothing
        }
    }
    throw e
}

function isUndefined(value: unknown): value is undefined {
    return value === undefined
}
