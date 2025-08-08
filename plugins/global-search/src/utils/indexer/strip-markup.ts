const parser = new DOMParser()

/**
 * Strips all markup from a string.
 *
 * @example
 * stripMarkup("Hello <b>world</b>") // "Hello world"
 */
export function stripMarkup(text: string) {
    // Normalize explicit line breaks and hr's before parsing so words don't collapse
    const normalized = text.replace(/<(br|hr)\s*\/?>(?=\s*|$)/gi, "\n")

    const document = parser.parseFromString(normalized, "text/html")

    if (!document.body.textContent) return ""

    // all new lines and multiple spaces to single space
    return document.body.textContent.replaceAll("\n", " ").replaceAll(/\s+/g, " ").trim()
}
