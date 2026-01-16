import {
    type Collection,
    type CollectionItem,
    type CollectionItemInput,
    type Field,
    type FieldDataEntryInput,
    type FieldDataInput,
    framer,
} from "framer-plugin"
import type { FieldMappingItem } from "../components/FieldMapperRow"
import { assert } from "./assert"
import type { CSVRecord } from "./parseCSV"

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

export type ImportItem = CollectionItemInput & {
    action: "add" | "conflict" | "onConflictUpdate" | "onConflictSkip"
}

export interface ImportPayload {
    warnings: {
        missingSlugCount: number
        doubleSlugCount: number
        skippedValueCount: number
        skippedValueKeys: Set<string>
    }
    items: ImportItem[]
}

class ConversionError extends Error {}

const collator = new Intl.Collator("en", { sensitivity: "base" })
const BOOLEAN_TRUTHY_VALUES = /1|y(?:es)?|true/iu

function findRecordValue(record: CSVRecord, key: string) {
    const value = Object.entries(record).find(([k]) => collator.compare(k, key) === 0)?.[1]
    if (!value) {
        return null
    }
    return value
}

function isValidDate(date: Date): boolean {
    return !Number.isNaN(date.getTime())
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
function slugify(value: string): string {
    return value.toLowerCase().replace(nonSlugCharactersRegExp, "-").replace(trimSlugRegExp, "")
}

interface GetFieldDataEntryInputForFieldOpts {
    field: Field
    value: string | null
    allItemIdBySlug: Map<string, Map<string, string>>
    csvRecord: CSVRecord
}

function getFieldDataEntryInputForField(
    opts: GetFieldDataEntryInputForFieldOpts
): FieldDataEntryInput | ConversionError {
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
                return new ConversionError(`Invalid value for field "${opts.field.name}" expected a number`)
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
                return new ConversionError(`Invalid value for field "${opts.field.name}" expected a valid date`)
            }
            return { type: "date", value: date.toJSON() }
        }

        case "enum": {
            if (opts.value === null) {
                const [firstCase] = opts.field.cases
                assert(firstCase, `No cases found for enum "${opts.field.name}"`)
                return { type: "enum", value: firstCase.id }
            }
            const matchingCase = opts.field.cases.find(
                enumCase => collator.compare(enumCase.name, opts.value ?? "") === 0 || enumCase.id === opts.value
            )
            if (!matchingCase) {
                return new ConversionError(`Invalid case "${opts.value}" for enum "${opts.field.name}"`)
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
                return new ConversionError(`Invalid Collection reference "${opts.value}"`)
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
                    return new ConversionError(`Invalid Collection reference "${slug}"`)
                }
                referencedIds.push(referencedId)
            }

            return { type: "multiCollectionReference", value: referencedIds }
        }

        case "array":
        case "divider":
        case "unsupported":
            return new ConversionError(`Unsupported field type "${opts.field.type}"`)

        default:
            opts.field satisfies never
            return new ConversionError("This should not happen")
    }
}

/**
 * Process CSV records with custom field mapping
 * This version maps CSV columns to existing collection fields by name
 */
export interface ProcessRecordsWithFieldMappingOpts {
    collection: Collection
    csvRecords: CSVRecord[]
    slugFieldName: string
    mappings: FieldMappingItem[]
}

export async function prepareImportPayload(opts: ProcessRecordsWithFieldMappingOpts): Promise<ImportPayload> {
    if (!opts.collection.slugFieldName) {
        throw new ImportError("error", "Import failed. No slug field was found in your CMS Collection.")
    }

    const existingItems = await opts.collection.getItems()
    const fields = await opts.collection.getFields()

    const result: ImportPayload = {
        warnings: {
            missingSlugCount: 0,
            doubleSlugCount: 0,
            skippedValueCount: 0,
            skippedValueKeys: new Set<string>(),
        },
        items: [],
    }

    const allItemIdBySlug = new Map<string, Map<string, string>>()

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

    for (const record of opts.csvRecords) {
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

        let draft = false
        if (hasDraftColumn) {
            const draftValue = findRecordValue(record, ":draft")
            if (draftValue && draftValue.trim() !== "") {
                draft = BOOLEAN_TRUTHY_VALUES.test(draftValue.trim())
            }
        } else {
            // Preserve existing draft value if no draft column in CSV
            const existingItem = existingItemsBySlug.get(slug)
            if (existingItem) {
                draft = existingItem.draft
            }
        }

        const fieldData: FieldDataInput = {}
        for (const mapping of opts.mappings) {
            if (mapping.action === "ignore") {
                continue
            }

            const csvColumnName = mapping.inferredField.columnName

            // Find the target field
            let field: Field | undefined
            if (mapping.action === "map" && mapping.targetFieldId) {
                field = fields.find(f => f.id === mapping.targetFieldId)
            } else if (mapping.action === "create") {
                // For created fields, find by name (case-insensitive)
                field = fields.find(f => collator.compare(f.name, mapping.inferredField.name) === 0)
            }

            if (!field) {
                continue
            }

            const value = findRecordValue(record, csvColumnName)
            const fieldDataEntry = getFieldDataEntryInputForField({ field, value, allItemIdBySlug, csvRecord: record })

            if (fieldDataEntry instanceof ConversionError) {
                result.warnings.skippedValueCount++
                result.warnings.skippedValueKeys.add(field.name)
                continue
            }

            fieldData[field.id] = fieldDataEntry
        }

        const item: ImportItem = {
            id: existingItemsBySlug.get(slug)?.id,
            slug,
            fieldData,
            action: existingItemsBySlug.get(slug) ? "conflict" : "add",
            draft,
        }

        newSlugValues.add(slug)

        result.items.push(item)
    }

    return result
}
