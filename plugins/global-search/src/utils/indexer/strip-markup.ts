const parser = new DOMParser()

/**
 * Strips all markup from a string.
 *
 * @example
 * stripMarkup("Hello <b>world</b>") // "Hello world"
 */
export function stripMarkup(text: string) {
    const document = parser.parseFromString(text, "text/html")

    if (!document.body.textContent) return ""

    // all new lines and multiple spaces to single space
    return document.body.textContent.replaceAll("\n", " ").replaceAll(/\s+/g, " ").trim()
}
