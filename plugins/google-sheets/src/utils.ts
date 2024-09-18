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

export function parseToUTCDate(date: string): string | null {
    const parsedDate = new Date(date)
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString()
    }
    return null
}

export function isDefined<T>(value: T): value is NonNullable<T> {
    return value !== undefined && value !== null
}

export function parseStringToArray<T>(rawStr: string | null, type: "string" | "number"): T[] {
    if (!rawStr) return []

    const parsed = JSON.parse(rawStr)
    if (!Array.isArray(parsed)) return []
    if (!parsed.every(val => typeof val === type)) return []

    return parsed
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
