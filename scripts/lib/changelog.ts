import { remark } from "remark"
import remarkHtml from "remark-html"

/**
 * Converts a markdown string to HTML using remark.
 */
export async function changelogToHtml(markdown: string): Promise<string> {
    const result = await remark().use(remarkHtml).process(markdown)
    return String(result)
}
