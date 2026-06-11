/**
 * Text Extractor
 *
 * Intelligently extracts and truncates body text from HTML documents
 * for AI analysis while preserving readability and context.
 */

/**
 * Extract body text excerpt (500-1000 words) from DOM document
 */
export function extractBodyTextExcerpt(doc: Document, targetWords = 750): string {
    // Remove unwanted elements
    const cleanedDoc = cleanDocument(doc)

    // Extract main content text
    const mainContent = extractMainContent(cleanedDoc)

    // Truncate to target word count at sentence boundaries
    return truncateAtSentenceBoundary(mainContent, targetWords)
}

/**
 * Clean document by removing unwanted elements
 */
function cleanDocument(doc: Document): Document {
    const clonedDoc = doc.cloneNode(true) as Document

    // Elements to remove (scripts, styles, navigation, etc.)
    const selectorsToRemove = [
        "script",
        "style",
        "nav",
        "header",
        "footer",
        "aside",
        ".navigation",
        ".nav",
        ".menu",
        ".sidebar",
        ".advertisement",
        ".ads",
        ".social-share",
        ".comments",
        ".related-posts",
        ".breadcrumb",
        ".cookie-notice",
        ".popup",
        ".modal",
    ]

    selectorsToRemove.forEach(selector => {
        const elements = clonedDoc.querySelectorAll(selector)
        elements.forEach(el => {
            el.remove()
        })
    })

    return clonedDoc
}

/**
 * Extract main content from cleaned document
 */
function extractMainContent(doc: Document): string {
    // Try to find main content containers first
    const mainSelectors = [
        "main",
        "article",
        ".content",
        ".main-content",
        ".post-content",
        ".entry-content",
        ".article-content",
        "#content",
        ".page-content",
    ]

    for (const selector of mainSelectors) {
        const mainElement = doc.querySelector(selector)
        if (mainElement) {
            return extractTextFromElement(mainElement)
        }
    }

    // Fallback to body if no main content found
    return extractTextFromElement(doc.body)
}

/**
 * Extract text content from an element, preserving paragraph structure
 */
function extractTextFromElement(element: Element): string {
    const paragraphs: string[] = []

    // Extract text from paragraphs
    const pElements = element.querySelectorAll("p")
    pElements.forEach(p => {
        const text = p.textContent.trim()
        if (text && text.length > 10) {
            // Skip very short paragraphs
            paragraphs.push(text)
        }
    })

    // If no paragraphs found, extract from all text content
    if (paragraphs.length === 0) {
        const text = element.textContent.trim()
        if (text) {
            // Split by double newlines or periods followed by spaces
            const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/).filter(s => s.trim().length > 10)
            return sentences.join(" ")
        }
    }

    return paragraphs.join(" ")
}

/**
 * Truncate text to target word count at sentence boundaries
 */
function truncateAtSentenceBoundary(text: string, targetWords: number): string {
    if (!text) return ""

    // Split into sentences
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)

    let result = ""
    let wordCount = 0

    for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/).length
        const newWordCount = wordCount + sentenceWords

        // If adding this sentence would exceed target, check if we're close enough
        if (newWordCount > targetWords) {
            // If we're within 20% of target, include the sentence
            if (wordCount >= targetWords * 0.8) {
                break
            }
            // If we're still far from target, include the sentence
            if (wordCount < targetWords * 0.5) {
                result += (result ? " " : "") + sentence
                wordCount = newWordCount
                continue
            }
            break
        }

        result += (result ? " " : "") + sentence
        wordCount = newWordCount
    }

    return result.trim()
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
    if (!text) return 0
    return text
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0).length
}
