const parser = new DOMParser()

/**
 * Strips all markup from a string.
 *
 * @example
 * stripMarkup("Hello <b>world</b>") // "Hello world"
 */
export function stripMarkup(text: string) {
    const normalized = text
        // Normalize explicit line breaks and hr's before parsing so words don't collapse
        .replace(/<(br|hr)\s*\/?>/gi, " ")
        // Add spaces before closing block element tags to prevent words from merging
        .replace(/<\/(p|div|h[1-6]|li|section|article|header|footer|nav|aside|blockquote)>/gi, " ")

    const document = parser.parseFromString(normalized, "text/html")

    if (!document.body.textContent) return ""
    // all new lines and multiple spaces to single space
    return document.body.textContent.replaceAll("\n", " ").replaceAll(/\s+/g, " ").trim()
}
