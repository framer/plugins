import { ManagedCollectionField } from "framer-plugin"

export const FIELD_DELIMITER = "rfa4Emr21pUgs0in"

export function assert(condition: unknown, ...msg: unknown[]): asserts condition {
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

export function isDefined<T>(value: T): value is NonNullable<T> {
    return value !== undefined && value !== null
}

/**
 * Generates an 8-character unique ID from a text using the djb2 hash function.
 * Converts the 32-bit hash to an unsigned integer and then to a hex string.
 */
export function generateHash(text: string): string {
    let hash = 5381
    for (let i = 0, len = text.length; i < len; i++) {
        hash = (hash * 33) ^ text.charCodeAt(i)
    }
    // Convert to unsigned 32-bit integer
    const unsignedHash = hash >>> 0
    return unsignedHash.toString(16).padStart(8, "0")
}

/**
 * Creates a consistent hash from an array of field IDs
 */
export function createFieldSetHash(fieldIds: string[]): string {
    // Ensure consistent ordering
    const sortedIds = [...fieldIds].sort()
    return generateHash(sortedIds.join(FIELD_DELIMITER))
}

/**
 * Processes a field set to determine the complementary fields
 */
export function computeFieldSets(params: {
    currentFields: ManagedCollectionField[]
    allPossibleFieldIds: string[]
    storedHash: string
}) {
    const { currentFields, allPossibleFieldIds, storedHash } = params
    const currentFieldIds = currentFields.map(field => field.id)

    const includedFieldIds = currentFieldIds

    const excludedFieldIds = allPossibleFieldIds.filter(id => !currentFieldIds.includes(id))

    const currentHash = createFieldSetHash(includedFieldIds)

    return {
        includedFieldIds,
        excludedFieldIds,
        hasHashChanged: storedHash !== currentHash,
    }
}
