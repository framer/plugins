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

export function isDefined<T>(value: T): value is NonNullable<T> {
    return value !== undefined && value !== null
}

export function isString(value: unknown): value is string {
    return typeof value === "string"
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

export function isURL(value: string): boolean {
    try {
        new URL(value)

        return true
    } catch {
        return false
    }
}

export function formatDate(isoDateString: string) {
    const date = new Date(isoDateString)

    // Example: Format as 'April 26, 2024 15:30'
    return date.toLocaleString("en-US", {
        day: "2-digit",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    })
}

export function generateRandomId() {
    const array = new Uint8Array(16)
    window.crypto.getRandomValues(array)

    let id = ""
    for (let i = 0; i < array.length; i++) {
        id += array[i].toString(16).padStart(2, "0")
    }

    return id
}
