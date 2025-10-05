import { marked } from "marked"
import type { PossibleField } from "./fields"

/**
 * Type guard to check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined
}

/**
 * Asserts that a condition is true, throwing an error if it's not
 */
export function assert(condition: boolean, message?: string): asserts condition {
    if (!condition) {
        throw new Error(message ?? "Assertion failed")
    }
}

/**
 * Converts markdown-style rich text to HTML
 */
export function richTextToHTML(cellValue: string): string {
    return marked.parse(cellValue, {
        // This is needed for proper typing.
        async: false,
        // This adds support for tables and code blocks with language tags (```javascript ... ```).
        gfm: true,
        // This ensures single-line line breaks are preserved.
        breaks: true,
    })
}

/**
 * Formats an array of items into a grammatically correct list with "and" before the last item.
 * Examples:
 * - ["A"] -> "A"
 * - ["A", "B"] -> "A and B"
 * - ["A", "B", "C"] -> "A, B, and C"
 */
export function formatListWithAnd(items: string[]): string {
    if (items.length === 0) return ""
    if (items.length === 1) return items[0] ?? ""
    if (items.length === 2) return `${items[0] ?? ""} and ${items[1] ?? ""}`

    const lastItem = items[items.length - 1] ?? ""
    const otherItems = items.slice(0, -1).join(", ")
    return `${otherItems}, and ${lastItem}`
}

// Allowed file types for attachments
export const ALLOWED_FILE_TYPES = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "tiff",
    "webp",
    "pdf",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "txt",
    "mp3",
    "aac",
    "mp4",
    "webm",
]

/**
 * Checks if a field is a collection reference.
 *
 * We check both the field type and airtableType because TypeScript's structural typing
 * allows for a theoretical mismatch between the two, even though they should always be in sync.
 */
export function isCollectionReference(field: PossibleField) {
    return (
        (field.type === "collectionReference" || field.type === "multiCollectionReference") &&
        field.airtableType === "multipleRecordLinks"
    )
}
