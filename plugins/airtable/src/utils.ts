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

export const listFormatter = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
})

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
