import type { SEOCheck } from "../../types/seo"

/**
 * String normalization utilities for keyword matching
 */
export function stripDiacritics(s: string): string {
    if (!s || typeof s !== "string") return ""
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function normalizeForMatch(s: string): string {
    if (!s || typeof s !== "string") return ""
    return stripDiacritics(s)
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
}

export function containsPhrase(text: string, phrase: string): boolean {
    if (!text || !phrase || typeof text !== "string" || typeof phrase !== "string") return false

    const normText = normalizeForMatch(text)
    const normPhrase = normalizeForMatch(phrase)

    return normText.includes(normPhrase)
}

export function countPhrase(text: string, phrase: string): number {
    if (!text || !phrase || typeof text !== "string" || typeof phrase !== "string") return 0

    const normText = normalizeForMatch(text)
    const normPhrase = normalizeForMatch(phrase)

    if (!normPhrase) return 0

    const regex = new RegExp(normPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
    const matches = normText.match(regex)
    return matches ? matches.length : 0
}

/**
 * Keyword placement check types
 */
export interface Check {
    status: "pass" | "fail" | "warning"
    description: string
    evidence: string
    suggestions?: string[]
}

export interface PageBits {
    title: string
    metaDescription: string
    h1: string
}

/**
 * Check if keyword appears in title
 */
export function checkTitleHasKeyword(title: string, keyword: string): Check {
    // If title is missing
    if (!title.trim()) {
        return {
            status: "fail",
            description: "Set Page Title first",
            evidence: "No title tag found",
            suggestions: ["Add a descriptive title tag", "Include your focus keyword in the title"],
        }
    }

    // If keyword is missing
    if (!keyword.trim()) {
        return {
            status: "fail",
            description: "Main Keyword is not set to check for placement",
            evidence: "No main keyword found to check for placement",
            suggestions: ["Add a Main Keyword", "Use it naturally in the content"],
        }
    }

    // Check keyword presence
    const has = containsPhrase(title, keyword)
    return {
        status: has ? "pass" : "warning",
        description: has ? "Main Keyword present in Title" : "Main Keyword not found in Title",
        evidence: title,
        suggestions: has ? [] : [`Include "${keyword}" once near the start if it reads naturally`],
    }
}

/**
 * Check if keyword appears in meta description
 */
export function checkMetaHasKeyword(metaDescription: string, keyword: string): Check {
    // If meta is missing
    if (!metaDescription.trim()) {
        return {
            status: "fail",
            description: "Set Page Description first",
            evidence: "No meta description found",
            suggestions: ["Add a compelling meta description", "Include your focus keyword naturally"],
        }
    }

    // If keyword is missing
    if (!keyword.trim()) {
        return {
            status: "fail",
            description: "Main Keyword is not set to check for placement",
            evidence: "No main keyword found to check for placement",
            suggestions: ["Add a Main Keyword", "Use it naturally in the content"],
        }
    }

    // Check keyword presence
    const has = containsPhrase(metaDescription, keyword)
    const preview = metaDescription.length > 180 ? `${metaDescription.slice(0, 180)}…` : metaDescription
    return {
        status: has ? "pass" : "warning",
        description: has ? "Main Keyword present in Description" : "Main Keyword not found in Description",
        evidence: preview,
        suggestions: has ? [] : [`Work "${keyword}" naturally into one sentence; avoid stuffing`],
    }
}

/**
 * Check if keyword appears in H1
 */
export function checkH1HasKeyword(h1: string, keyword: string, allH1s?: string[]): Check {
    // If H1 is missing
    if (!h1.trim()) {
        return {
            status: "fail",
            description: "Set H1 Heading first",
            evidence: "No H1 tag found",
            suggestions: ["Add a clear main heading that describes the page content"],
        }
    }

    // If multiple H1s exist
    if (allH1s && allH1s.length > 1) {
        return {
            status: "fail",
            description: "More than one H1 Heading. Set one H1 per page first",
            evidence: allH1s.join(", "),
            suggestions: [
                "Keep one primary H1 that describes the page's topic",
                "Use H2s/H3s for subsections to maintain logical structure",
            ],
        }
    }

    // If keyword is missing
    if (!keyword.trim()) {
        return {
            status: "warning",
            description: "Main Keyword is not set to check for placement",
            evidence: "No main keyword found to check for placement",
            suggestions: ["Add a Main Keyword", "Use it naturally in the content"],
        }
    }

    // Check keyword presence
    const has = containsPhrase(h1, keyword)
    return {
        status: has ? "pass" : "warning",
        description: has ? "Main Keyword present in H1" : "Main Keyword not found in H1",
        evidence: h1,
        suggestions: has ? [] : [`Include "${keyword}" naturally in the main heading if it matches the topic`],
    }
}

/**
 * Check for possible keyword stuffing across all elements
 */
export function checkPossibleKeywordStuffing(pageBits: PageBits, keyword: string): Check {
    if (!keyword) {
        return {
            status: "warning",
            description: "Keyword stuffing check not available",
            evidence: "No keyword provided",
        }
    }

    const totalCount =
        countPhrase(pageBits.title, keyword) +
        countPhrase(pageBits.metaDescription, keyword) +
        countPhrase(pageBits.h1, keyword)

    if (totalCount <= 3) {
        return {
            status: "pass",
            description: "No keyword stuffing detected",
            evidence: `Keyword appears ${totalCount} times total`,
        }
    } else {
        return {
            status: "warning",
            description: "Possible keyword stuffing detected",
            evidence: `Keyword appears ${totalCount} times total (recommended: 3 or fewer)`,
        }
    }
}

/**
 * Convert Check to SEOCheck format
 */
export function checkToSEOCheck(check: Check, id: string, name: string): SEOCheck {
    return {
        id,
        name,
        status: check.status,
        description: check.description,
        evidence: check.evidence,
        importance: "high",
        category: "content",
        suggestions: [],
    }
}
