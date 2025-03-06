import { PossibleField } from "./data"

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
    let html = cellValue
        .replace(/^###### (.*)$/gim, "<h6>$1</h6>") // H6
        .replace(/^##### (.*)$/gim, "<h5>$1</h5>") // H5
        .replace(/^#### (.*)$/gim, "<h4>$1</h4>") // H4
        .replace(/^### (.*)$/gim, "<h3>$1</h3>") // H3
        .replace(/^## (.*)$/gim, "<h2>$1</h2>") // H2
        .replace(/^# (.*)$/gim, "<h1>$1</h1>") // H1
        .replace(/^> (.*)$/gim, "<blockquote>$1</blockquote>") // Blockquote
        .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>") // Bold
        .replace(/\*(.*?)\*/gim, "<em>$1</em>") // Italic
        .replace(/~~(.*?)~~/gim, "<del>$1</del>") // Strikethrough
        .replace(/`([^`]+)`/gim, "<code>$1</code>") // Inline code
        .replace(/```([\s\S]*?)```/gim, "<pre><code>$1</code></pre>") // Code block
        .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>') // Links

    // Handle unordered and ordered lists separately
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, "<ul><li>$1</li></ul>")
    html = html.replace(/^\s*\d+\.\s+(.*)$/gim, "<ol><li>$1</li></ol>")

    // Combine consecutive <ul> or <ol> items
    html = html.replace(/<\/ul>\s*<ul>/gim, "").replace(/<\/ol>\s*<ol>/gim, "")

    // Ensure paragraphs are correctly wrapped
    html = html
        .split("\n\n") // Assume two newlines is a new paragraph
        .map(paragraph => {
            if (!/^<.*>.*<\/.*>$/.test(paragraph)) {
                return `<p>${paragraph}</p>`
            }
            return paragraph
        })
        .join("")

    return html
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

export function isCollectionReference(field: PossibleField) {
    return field.airtableType === "multipleRecordLinks"
}
