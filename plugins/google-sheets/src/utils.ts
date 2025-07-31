import type { ProtectedMethod } from "framer-plugin"

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
 * Takes a string and removes all characters except letters, numbers, and parentheses
 * Also, makes it lower case and separates words by dashes
 */
export function slugify(value: string): string {
    return value.toLowerCase().replace(nonSlugCharactersRegExp, "-").replace(trimSlugRegExp, "")
}

export function isDefined<T>(value: T): value is NonNullable<T> {
    return value !== undefined && value !== null
}

export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Converts a sheet column number to a letter
 */
export function columnToLetter(column: number): string {
    let remainder: number
    let letter = ""

    while (column > 0) {
        remainder = (column - 1) % 26
        letter = String.fromCharCode(remainder + 65) + letter
        column = Math.floor((column - remainder - 1) / 26)
    }

    return letter
}

/**
 * Generates an 8-character unique ID from a text using the djb2 hash function.
 * Converts the 32-bit hash to an unsigned integer and then to a hex string.
 */
export function generateHashId(text: string): string {
    let hash = 5381
    for (let i = 0, len = text.length; i < len; i++) {
        hash = (hash * 33) ^ text.charCodeAt(i)
    }
    // Convert to unsigned 32-bit integer
    const unsignedHash = hash >>> 0
    return unsignedHash.toString(16).padStart(8, "0")
}

/**
 * Generates unique names by appending a suffix if the name is already used.
 */
export function generateUniqueNames(names: string[]): string[] {
    const nameCount = new Map<string, number>()

    return names.map(name => {
        const count = nameCount.get(name) ?? 0
        nameCount.set(name, count + 1)

        return count > 0 ? `${name} ${count + 1}` : name
    })
}

export const syncMethods = [
    "ManagedCollection.addItems",
    "ManagedCollection.removeItems",
    "ManagedCollection.setItemOrder",
    "ManagedCollection.setPluginData",
] as const satisfies ProtectedMethod[]
