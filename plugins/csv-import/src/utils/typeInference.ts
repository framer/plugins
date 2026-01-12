import type { VirtualFieldType } from "./virtualTypes"

export interface InferredField {
    name: string
    columnName: string
    inferredType: VirtualFieldType
    allowedTypes: VirtualFieldType[]
}

const BOOLEAN_TRUTHY_VALUES = /^(1|y(?:es)?|true)$/iu
const BOOLEAN_FALSY_VALUES = /^(0|n(?:o)?|false)$/iu
const URL_PATTERN = /^https?:\/\/.+/i
const COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const IMAGE_URL_PATTERN = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i

function hasTimeComponent(dateStrings: string[]): boolean {
    return dateStrings.some(dateStr => {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) {
            return false
        }

        // Check hours, minutes, seconds, milliseconds using UTC to avoid timezone issues
        return (
            date.getUTCHours() !== 0 ||
            date.getUTCMinutes() !== 0 ||
            date.getUTCSeconds() !== 0 ||
            date.getUTCMilliseconds() !== 0
        )
    })
}

/**
 * Infer the field type from CSV data
 */
function inferFieldType(values: (string | null)[]): VirtualFieldType {
    const nonNullValues = values.filter((v): v is string => v !== null && v.trim() !== "")

    if (nonNullValues.length === 0) {
        return "string"
    }

    // Check if all values are booleans
    const allBoolean = nonNullValues.every(v => BOOLEAN_TRUTHY_VALUES.test(v) || BOOLEAN_FALSY_VALUES.test(v))
    if (allBoolean) {
        return "boolean"
    }

    // Check if all values are numbers
    const allNumbers = nonNullValues.every(v => {
        const num = Number(v)
        return !Number.isNaN(num) && v.trim() !== ""
    })
    if (allNumbers) {
        return "number"
    }

    // Check if all values are valid dates
    const allDates = nonNullValues.every(v => {
        const date = new Date(v)
        return !Number.isNaN(date.getTime())
    })
    if (allDates && nonNullValues.length > 0) {
        // Additional check: ensure it looks like a date string
        const hasDateLikeFormat = nonNullValues.some(
            v =>
                /\d{4}-\d{2}-\d{2}/.test(v) || // ISO format
                /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v) || // Common date formats
                /\d{1,2}-\d{1,2}-\d{2,4}/.test(v)
        )
        if (hasDateLikeFormat) {
            // Check if values contain time components
            const hasTime = hasTimeComponent(nonNullValues)
            return hasTime ? "datetime" : "date"
        }
    }

    // Check if all values are colors
    const allColors = nonNullValues.every(v => COLOR_PATTERN.test(v.trim()))
    if (allColors) {
        return "color"
    }

    // Check if all values are image URLs
    const allImageUrls = nonNullValues.every(v => IMAGE_URL_PATTERN.test(v.trim()))
    if (allImageUrls) {
        return "image"
    }

    // Check if all values are URLs
    const allUrls = nonNullValues.every(v => URL_PATTERN.test(v.trim()))
    if (allUrls) {
        return "link"
    }

    // Check if values contain HTML or markdown (formatted text)
    const hasFormatting = nonNullValues.some(
        v =>
            /<[^>]+>/.test(v) || // HTML tags
            /\*\*.*\*\*/.test(v) || // Bold markdown
            /\*.*\*/.test(v) || // Italic markdown
            /\[.*\]\(.*\)/.test(v) // Markdown links
    )
    if (hasFormatting) {
        return "formattedText"
    }

    // Default to string
    return "string"
}

/**
 * Get allowed types for a field based on its inferred type
 */
function getAllowedTypes(inferredType: VirtualFieldType): VirtualFieldType[] {
    // Define which types can be converted to which other types
    const typeCompatibility: Record<VirtualFieldType, VirtualFieldType[]> = {
        string: ["string", "formattedText", "link", "color", "file", "image"],
        formattedText: ["formattedText", "string"],
        number: ["number", "string"],
        boolean: ["boolean", "string"],
        date: ["date", "datetime", "string"],
        datetime: ["datetime", "date", "string"],
        color: ["color", "string"],
        link: ["link", "string"],
        image: ["image", "file", "link", "string"],
        file: ["file", "link", "string"],
        enum: ["enum", "string"],
        collectionReference: ["collectionReference"],
        multiCollectionReference: ["multiCollectionReference"],
        array: ["array"],
        divider: ["divider"],
        unsupported: ["unsupported"],
    }

    return typeCompatibility[inferredType]
}

/**
 * Infer field types from CSV records
 */
export function inferFieldsFromCSV(records: Record<string, string>[]): InferredField[] {
    if (records.length === 0) {
        return []
    }

    const firstRecord = records[0]
    if (!firstRecord) {
        return []
    }

    const fieldNames = Object.keys(firstRecord)
    const inferredFields: InferredField[] = []

    for (const fieldName of fieldNames) {
        // Skip special fields
        if (fieldName.startsWith(":")) {
            continue
        }

        // Collect all values for this field
        const values = records.map(record => {
            const value = record[fieldName]
            return value && value.trim() !== "" ? value : null
        })

        const inferredType = inferFieldType(values)
        const allowedTypes = getAllowedTypes(inferredType)

        inferredFields.push({
            name: fieldName,
            columnName: fieldName,
            inferredType,
            allowedTypes,
        })
    }

    return inferredFields
}
