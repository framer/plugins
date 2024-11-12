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

export const parseJsonToArray = <T>(jsonString: string | null): T[] | null => {
    if (jsonString === null) return null

    try {
        const parsedData = JSON.parse(jsonString)

        if (Array.isArray(parsedData)) {
            return parsedData as T[]
        } else {
            return null
        }
    } catch (error) {
        return null
    }
}

export const isDefined = <T>(value: T): value is NonNullable<T> => {
    return value !== undefined && value !== null
}

export const capitalize = (str: string) => {
    if (str.length === 0) {
        return str
    }

    return str.charAt(0).toUpperCase() + str.slice(1)
}
