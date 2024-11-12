import { framer, ManagedCollectionField } from "framer-plugin"
import { useEffect } from "react"

export const MAX_CMS_ITEMS = 10_000
export const PLUGIN_LOG_SYNC_KEY = "salesforceLogSyncResult"

export interface ItemResult {
    fieldName?: string
    message: string
}

export interface SyncStatus {
    errors: ItemResult[]
    warnings: ItemResult[]
    info: ItemResult[]
}

export interface SyncResult extends SyncStatus {
    status: "success" | "completed_with_errors"
}

export type FieldsById = Map<string, ManagedCollectionField>

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

const isLoggingEnabled = () => {
    return localStorage.getItem(PLUGIN_LOG_SYNC_KEY) === "true"
}

export function logSyncResult(result: SyncResult, collectionItems?: Record<string, unknown>[]) {
    if (!isLoggingEnabled()) return

    if (collectionItems) {
        console.table(collectionItems)
    }

    if (result.errors.length > 0) {
        console.log("Completed errors:")
        console.table(result.errors)
    }

    if (result.warnings.length > 0) {
        console.log("Completed warnings:")
        console.table(result.warnings)
    }

    console.log("Completed info:")
    console.table(result.info)
}

export const useLoggingToggle = () => {
    useEffect(() => {
        const isLoggingEnabled = () => localStorage.getItem(PLUGIN_LOG_SYNC_KEY) === "true"

        const toggle = () => {
            const newState = !isLoggingEnabled()
            localStorage.setItem(PLUGIN_LOG_SYNC_KEY, newState ? "true" : "false")
            framer.notify(`Logging ${newState ? "enabled" : "disabled"}`, { variant: "info" })
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === "L") {
                e.preventDefault()
                toggle()
            }
        }

        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [])
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
