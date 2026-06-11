/**
 * Content Feature Extractor
 *
 * Detects and counts various content features in HTML documents
 * to provide context about content type and richness for AI analysis.
 */

export interface ContentFeatures {
    lists: number
    tables: number
    faqs: number
    blockquotes: number
    codeBlocks: number
}

/**
 * Extract content features from a DOM document
 */
export function extractContentFeatures(doc: Document): ContentFeatures {
    return {
        lists: countLists(doc),
        tables: countTables(doc),
        faqs: countFAQs(doc),
        blockquotes: countBlockquotes(doc),
        codeBlocks: countCodeBlocks(doc),
    }
}

/**
 * Count list elements (ul, ol)
 */
function countLists(doc: Document): number {
    const lists = doc.querySelectorAll("ul, ol")
    return lists.length
}

/**
 * Count table elements
 */
function countTables(doc: Document): number {
    const tables = doc.querySelectorAll("table")
    return tables.length
}

/**
 * Count FAQ patterns
 * - dt/dd pairs (definition lists used as FAQs)
 * - Accordion patterns (common FAQ structure)
 * - Question headings (h2/h3 with question patterns)
 */
function countFAQs(doc: Document): number {
    let faqCount = 0

    // Count dt/dd pairs (definition lists)
    const definitionLists = doc.querySelectorAll("dl")
    definitionLists.forEach(dl => {
        const dts = dl.querySelectorAll("dt")
        const dds = dl.querySelectorAll("dd")
        // Consider it FAQ if there are dt/dd pairs
        if (dts.length > 0 && dds.length > 0) {
            faqCount += Math.min(dts.length, dds.length)
        }
    })

    // Count accordion patterns (common FAQ structure)
    const accordions = doc.querySelectorAll("[data-accordion], .accordion, .faq-accordion")
    faqCount += accordions.length

    // Count question headings (h2/h3 with question patterns)
    const headings = doc.querySelectorAll("h2, h3, h4")
    headings.forEach(heading => {
        const text = heading.textContent.trim()
        if (isQuestionPattern(text)) {
            faqCount++
        }
    })

    return faqCount
}

/**
 * Check if text matches common question patterns
 */
function isQuestionPattern(text: string): boolean {
    const questionPatterns = [
        /^what\s+/i,
        /^how\s+/i,
        /^why\s+/i,
        /^when\s+/i,
        /^where\s+/i,
        /^who\s+/i,
        /\?$/,
        /^is\s+/i,
        /^are\s+/i,
        /^do\s+/i,
        /^does\s+/i,
        /^can\s+/i,
        /^could\s+/i,
        /^should\s+/i,
        /^would\s+/i,
    ]

    return questionPatterns.some(pattern => pattern.test(text))
}

/**
 * Count blockquote elements
 */
function countBlockquotes(doc: Document): number {
    const blockquotes = doc.querySelectorAll("blockquote")
    return blockquotes.length
}

/**
 * Count code blocks (pre/code elements)
 */
function countCodeBlocks(doc: Document): number {
    // Count pre elements (usually contain code blocks)
    const preElements = doc.querySelectorAll("pre")

    // Count standalone code elements (not inside pre)
    const codeElements = doc.querySelectorAll("code")
    const codeInPre = doc.querySelectorAll("pre code")

    return preElements.length + (codeElements.length - codeInPre.length)
}
