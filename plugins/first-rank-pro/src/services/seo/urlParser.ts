/**
 * URL Parser
 *
 * Parses URLs into meaningful path segments to understand
 * page hierarchy and topic structure for AI analysis.
 */

/**
 * Parse URL into meaningful path segments
 */
export function parseUrlSegments(url: string): string[] {
    try {
        const urlObj = new URL(url)
        const pathname = urlObj.pathname

        // Split pathname into segments
        const segments = pathname.split("/").filter(segment => segment.length > 0) // Remove empty segments

        // Filter out common non-meaningful segments
        const filteredSegments = segments.filter(segment => !isCommonSegment(segment))

        // If no meaningful segments, return the domain as context
        if (filteredSegments.length === 0) {
            return [urlObj.hostname.replace("www.", "")]
        }

        return filteredSegments
    } catch (error) {
        // If URL parsing fails, try to extract segments from string
        return extractSegmentsFromString(url)
    }
}

/**
 * Check if a segment is a common non-meaningful segment
 */
function isCommonSegment(segment: string): boolean {
    const commonSegments = [
        "index",
        "home",
        "page",
        "p",
        "id",
        "slug",
        "post",
        "article",
        "blog",
        "news",
        "category",
        "tag",
        "search",
        "sitemap",
        "robots",
        "favicon",
        "css",
        "js",
        "images",
        "img",
        "assets",
        "static",
        "public",
        "api",
        "admin",
        "wp-admin",
        "wp-content",
        "wp-includes",
    ]

    // Check exact matches
    if (commonSegments.includes(segment.toLowerCase())) {
        return true
    }

    // Check if it's a numeric ID (like /123 or /p/456)
    if (/^\d+$/.test(segment)) {
        return true
    }

    // Check if it's a common file extension
    if (/\.(html?|php|asp|jsp|cgi)$/i.test(segment)) {
        return true
    }

    return false
}

/**
 * Extract segments from string when URL parsing fails
 */
function extractSegmentsFromString(url: string): string[] {
    // Remove protocol and domain
    let path = url.replace(/^https?:\/\/[^/]+/, "")

    // Remove query parameters and fragments
    path = path.split("?")[0]?.split("#")[0] ?? ""

    // Split into segments
    const segments = path
        .split("/")
        .filter(segment => segment.length > 0)
        .filter(segment => !isCommonSegment(segment))

    return segments.length > 0 ? segments : ["unknown"]
}

/**
 * Get page hierarchy level from URL segments
 */
export function getPageHierarchyLevel(url: string): number {
    const segments = parseUrlSegments(url)
    return segments.length
}

/**
 * Extract topic keywords from URL segments
 */
export function extractTopicKeywords(url: string): string[] {
    const segments = parseUrlSegments(url)

    return segments
        .map(segment => segment.replace(/[-_]/g, " ")) // Replace hyphens/underscores with spaces
        .map(segment => segment.toLowerCase())
        .filter(segment => segment.length > 2) // Filter out very short segments
}
