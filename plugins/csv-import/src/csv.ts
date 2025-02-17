import { Collection, CollectionField, CollectionItem, CollectionItemInput, framer } from "framer-plugin"

type CSVRecord = Record<string, string>

export type ImportResultItem = CollectionItemInput & {
    action: "add" | "conflict" | "onConflictUpdate" | "onConflictSkip"
}

export type ImportResult = {
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
    let error: unknown

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
            const parsed = parse(data, { ...options, delimiter })

            // It can happen that parsing succeeds with the wrong delimiter. For example, a tab separated file could be parsed
            // successfully with comma separators. If that's the case, we can find it by checking two things:
            // 1. That the resulting records have more than one column
            // 2. That if there's only one column, it does not contain delimiters
            // If both of those conditions are met, we can assume there's a parsing error and should not import the records
            const firstItemKeys = isArray(parsed) && parsed[0] && isObject(parsed[0]) ? Object.keys(parsed[0]) : []
            if (firstItemKeys.length < 2) {
                const delimiterInKey = delimiters.some(del => firstItemKeys[0]?.includes(del))
                if (delimiterInKey) {
                    error = "Parsed with incorrect delimiter"
                    continue
                }
            }

            error = undefined
            records = parsed
            break
        } catch (err) {
            error = err
        }
    }

    if (error) {
        throw error
    }

    return records
}

/** Error when importing fails, internal to `RecordImporter` */
class ImportError extends Error {
    /**
     * @param variant Notification variant to show the user
     * @param message Message to show the user
     */
    constructor(readonly variant?: "error" | "warning", message?: string) {
        super(message)
    }
}

/** Used to indicated a value conversion failed, used by `RecordImporter` and `setValueForVariable` */
class ConversionError extends Error {}

const findRecordValue = (record: CSVRecord, key: string) => {
    const value = Object.entries(record).find(([k]) => collator.compare(k, key) === 0)?.[1]
    if (!value) {
        return null
    }
    return value
}

const collator = new Intl.Collator("en", { sensitivity: "base" })
const BOOLEAN_TRUTHY_VALUES = /1|y(?:es)?|true/iu

function getRecordValueForField(
    field: CollectionField,
    value: string | null,
    allItemIdBySlug: Map<string, Map<string, string>>
) {
    if (value === null) {
        return undefined
    }

    switch (field.type) {
        case "string":
        case "formattedText":
        case "link":
        case "color":
        case "file":
        case "image":
            return value.trim()

        case "number": {
            const number = Number(value)
            if (Number.isNaN(number)) {
                return new ConversionError(`Invalid value for field “${field.name}” expected a number`)
            }
            return number
        }

        case "boolean":
            return BOOLEAN_TRUTHY_VALUES.test(value)

        case "date": {
            const date = new Date(value)
            if (!isValidDate(date))
                return new ConversionError(`Invalid value for field “${field.name}” expected a valid date`)
            const isoDate = date.toISOString().split("T")[0]
            return new Date(isoDate).toJSON()
        }

        case "enum": {
            const matchingCase = field.cases.find(
                caseOption => collator.compare(caseOption.name, value) === 0 || caseOption.id === value
            )
            if (matchingCase) {
                return matchingCase.id
            }
            return new ConversionError(`Invalid case “${value}” for enum “${field.name}”`)
        }

        case "collectionReference": {
            const referencedSlug = value.trim()
            const referencedId = allItemIdBySlug.get(field.collectionId)?.get(referencedSlug)
            if (!referencedId) {
                return new ConversionError(`Invalid Collection reference “${value}”`)
            }

            return referencedId
        }

        case "multiCollectionReference": {
            const referencedSlugs = value.split(",").map(slug => slug.trim())

            const referencedIds: string[] = []

            for (const slug of referencedSlugs) {
                const referencedId = allItemIdBySlug.get(field.collectionId)?.get(slug)
                if (!referencedId) {
                    return new ConversionError(`Invalid Collection reference “${slug}”`)
                }
                referencedIds.push(referencedId)
            }

            return referencedIds
        }

        case "unsupported":
            return new ConversionError(`Unsupported field type “${field.type}”`)
    }
}

/** Importer for "records": string based values with named keys */
export async function processRecords(collection: Collection, records: CSVRecord[]) {
    const existingItems = await collection.getItems()

    if (!collection.slugFieldName) {
        throw new ImportError("error", "Import failed. Ensure your CMS Collection only has one Slug field.")
    }

    let slugFieldIndex: number | undefined
    for (const [index, key] of Object.keys(records[0]).entries()) {
        if (collator.compare(key, collection.slugFieldName) === 0) {
            slugFieldIndex = index
            break
        }
    }

    if (typeof slugFieldIndex !== "number") {
        throw new ImportError(
            "error",
            `Import failed. Ensure your CSV has a Slug field named “${collection.slugFieldName}”`
        )
    }

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

    for (const record of records) {
        const slug = Object.values(record)[slugFieldIndex]
        if (!slug) {
            result.warnings.missingSlugCount++
            continue
        } else if (newSlugValues.has(slug)) {
            result.warnings.doubleSlugCount++
            continue
        }

        const fieldData: Record<string, unknown> = {}
        for (const field of fields) {
            const value = findRecordValue(record, field.name)

            const fieldValue = getRecordValueForField(field, value, allItemIdBySlug)

            if (fieldValue instanceof ConversionError) {
                result.warnings.skippedValueCount++
                result.warnings.skippedValueKeys.add(field.name)
                continue
            }

            if (fieldValue !== undefined) {
                fieldData[field.id] = fieldValue
            }
        }

        const item: ImportResultItem = {
            id: existingItemsBySlug.get(slug)?.id,
            slug,
            fieldData,
            action: existingItemsBySlug.get(slug) ? "conflict" : "add",
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
            .map(item =>
                item.action === "add"
                    ? {
                          slug: item.slug!,
                          fieldData: item.fieldData,
                      }
                    : {
                          id: item.id!,
                          fieldData: item.fieldData,
                      }
            )
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
    await framer.closePlugin(finalMessage || "Successfully imported Collection", {
        variant: messages.length > 1 ? "warning" : "success",
    })
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
