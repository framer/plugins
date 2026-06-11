import type { ExtractedSEOData, SEOAnalysis, SEOCheck, SEOImage, SEOLink } from "../types/seo"
import { FramerImageService } from "./framerImageService"
import { extractContentFeatures } from "./seo/contentFeatureExtractor"
import {
    validateContentLength,
    validateFocusKeyword,
    validateH1,
    validateHeadingHierarchy,
    validateImageAlts,
    validateMetaDescription,
    validateTitle,
} from "./seo/contentValidator"
import { extractHeadings } from "./seo/headingExtractor"
import { checkH1HasKeyword, checkMetaHasKeyword, checkTitleHasKeyword, checkToSEOCheck } from "./seo/keywordMatcher"
import { extractBodyTextExcerpt } from "./seo/textExtractor"
import { parseUrlSegments } from "./seo/urlParser"

// Framer's own CORS proxy (the same worker official plugins use) is the default.
// Override with any transparent CORS-proxy prefix: the target URL is appended raw.
const PROXY_URL_PREFIX = import.meta.env.VITE_PROXY_URL ?? "https://framer-cors-proxy.framer-team.workers.dev/?"
// Generous timeout so slow or very large pages surface a real response (or the
// proxy's own error) instead of a confusing client-side abort.
const TIMEOUT = 20000 // 20 seconds
const HTML_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const htmlCache = new Map<string, { html: string; timestamp: number }>()

function getCachedHTML(url: string): string | null {
    const cached = htmlCache.get(url)
    if (!cached) return null

    const age = Date.now() - cached.timestamp
    if (age > HTML_CACHE_TTL) {
        htmlCache.delete(url)
        return null
    }

    return cached.html
}

function setCachedHTML(url: string, html: string): void {
    // Cleanup old entries (prevent memory leaks)
    if (htmlCache.size >= 20) {
        const entries = Array.from(htmlCache.entries())
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
        const oldest = entries[0]
        if (oldest) htmlCache.delete(oldest[0]) // Remove oldest
    }

    // Now add the new entry
    htmlCache.set(url, { html, timestamp: Date.now() })
}

async function fetchPageHTML(url: string): Promise<string> {
    // Check cache first
    const cached = getCachedHTML(url)
    if (cached) return cached

    try {
        // The proxy is transparent: it forwards status and body verbatim (including
        // 404 pages with their HTML), so the target URL is appended as-is. Freshness
        // is handled by our own in-memory cache plus "no-store" below.
        const proxyUrl = `${PROXY_URL_PREFIX}${url}`

        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
            controller.abort()
        }, TIMEOUT)

        try {
            const response = await fetch(proxyUrl, {
                signal: controller.signal,
                mode: "cors",
                cache: "no-store",
                headers: {
                    Accept: "text/html",
                },
            })

            if (!response.ok) {
                // Special handling for 404 pages - they're valid pages that return 404 status
                if (response.status === 404) {
                    const contentType = response.headers.get("content-type") ?? ""

                    // If content-type is HTML, the proxy passed through the 404 page HTML
                    if (contentType.includes("text/html")) {
                        const html = await response.text()
                        if (isValidHTML(html)) {
                            setCachedHTML(url, html)
                            return html
                        }
                    }

                    // If proxy returns JSON error for 404, try direct fetch as fallback
                    if (contentType.includes("application/json")) {
                        try {
                            const directResponse = await fetch(url, {
                                signal: controller.signal,
                                mode: "cors",
                                headers: { Accept: "text/html" },
                            })

                            const html = await directResponse.text()
                            if (isValidHTML(html)) {
                                setCachedHTML(url, html)
                                return html
                            }
                        } catch {
                            // Fall through to throw the original proxy error
                        }
                    }
                }

                // Try to get error details from response
                const contentType = response.headers.get("content-type") ?? ""
                if (contentType.includes("application/json")) {
                    const errorData = (await response.json()) as { error?: string }
                    throw new Error(`Proxy error: ${errorData.error ?? `HTTP ${String(response.status)}`}`)
                } else {
                    throw new Error(`HTTP error! status: ${String(response.status)}`)
                }
            }

            const html = await response.text()

            if (!html || !isValidHTML(html)) {
                throw new Error("Invalid HTML received from proxy")
            }

            // Cache the result
            setCachedHTML(url, html)

            return html
        } finally {
            clearTimeout(timeoutId)
        }
    } catch (error) {
        if (error instanceof Error) {
            // AbortError = our own TIMEOUT fired (request took longer than TIMEOUT ms)
            if (error.name === "AbortError") {
                throw new Error(
                    `Failed to fetch page content: timed out after ${String(TIMEOUT / 1000)}s fetching ${url}. ` +
                        `The page may be slow, very large, behind bot protection, or not published yet. Please try again.`
                )
            }
            // Network-level failure (offline, blocked, CORS) surfaces as TypeError "Failed to fetch"
            if (error.name === "TypeError") {
                throw new Error(
                    `Failed to fetch page content: could not reach the proxy (${error.message}) for ${url}. ` +
                        `Check your connection and that the page is published.`
                )
            }
            throw new Error(`Failed to fetch page content: ${error.message}`)
        } else {
            throw new Error("Failed to fetch page content: Unknown error")
        }
    }
}

function isValidHTML(html: string): boolean {
    return html.includes("<!DOCTYPE html>") || html.includes("<html") || html.includes("<body")
}

function normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, " ").normalize("NFKD").replace(/[̀-ͯ]/g, "")
}

function extractImages(doc: Document): SEOImage[] {
    const images: SEOImage[] = []
    const imageElements = doc.querySelectorAll("img")

    imageElements.forEach(img => {
        images.push({
            src: img.getAttribute("src") ?? "",
            alt: img.getAttribute("alt"),
            width: img.width || undefined,
            height: img.height || undefined,
            loading: img.getAttribute("loading") ?? undefined,
        })
    })

    return images
}

function extractLinks(doc: Document, baseUrl: string): SEOLink[] {
    const links: SEOLink[] = []
    const linkElements = doc.querySelectorAll("a")
    const baseHostname = new URL(baseUrl).hostname

    linkElements.forEach(link => {
        const href = link.getAttribute("href")
        if (!href) return

        try {
            const url = new URL(href, baseUrl)
            links.push({
                href: url.toString(),
                text: link.textContent.trim(),
                isInternal: url.hostname === baseHostname,
                isNofollow: link.getAttribute("rel")?.includes("nofollow") ?? false,
            })
        } catch {
            // Skip invalid URLs
        }
    })

    return links
}

function extractFirstParagraph(doc: Document): string {
    const paragraphs = doc.querySelectorAll("p")
    for (const p of paragraphs) {
        const text = p.textContent.trim()
        if (text.length > 50) {
            // Skip very short paragraphs
            return text
        }
    }
    return ""
}

function extractOpenGraphData(doc: Document): ExtractedSEOData["openGraphData"] {
    const data: ExtractedSEOData["openGraphData"] = {}
    const metaTags = doc.querySelectorAll('meta[property^="og:"]')

    metaTags.forEach(tag => {
        const property = tag.getAttribute("property")?.replace("og:", "")
        const content = tag.getAttribute("content")

        if (property && content) {
            switch (property) {
                case "title":
                    data.title = content
                    break
                case "description":
                    data.description = content
                    break
                case "image":
                    data.image = content
                    break
                case "type":
                    data.type = content
                    break
            }
        }
    })

    return data
}

function extractStructuredData(doc: Document): unknown[] {
    const data: unknown[] = []
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]')

    scripts.forEach(script => {
        try {
            data.push(JSON.parse(script.textContent || "{}"))
        } catch {
            // Skip invalid JSON
        }
    })

    return data
}

// ---------- Keyword matching helpers (diacritics/word-boundary aware) ----------

// Stores keyword placement evidence for the keyword-placement check
let keywordPlacementEvidence: {
    keyword: string
    title: SEOCheck
    meta: SEOCheck
    h1: SEOCheck
} | null = null

function extractSEOData(html: string, url: string): ExtractedSEOData {
    // Parse HTML string
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Extract basic meta data
    const titleElement = doc.querySelector("title")
    const metaDesc = doc.querySelector('meta[name="description"]')
    const canonical = doc.querySelector('link[rel="canonical"]')
    const viewport = doc.querySelector('meta[name="viewport"]')
    const robotsMeta = doc.querySelector('meta[name="robots"]')
    const charset = doc.querySelector("meta[charset]")
    const language = doc.documentElement.getAttribute("lang")

    // Extract text content
    const bodyText = doc.body.textContent.trim()
    const wordCount = bodyText.split(/\s+/).length

    // Extract enhanced data for AI analysis
    const contentFeatures = extractContentFeatures(doc)
    const bodyTextExcerpt = extractBodyTextExcerpt(doc, 750) // 750 words target
    const urlSegments = parseUrlSegments(url)
    const links = extractLinks(doc, url)
    const images = extractImages(doc)

    // Separate internal and external links
    const internalLinks = links.filter(link => link.isInternal)
    const externalLinks = links.filter(link => !link.isInternal)

    // Extract image alt texts
    const imageAlts = images.map(img => img.alt).filter((alt): alt is string => !!alt && alt.trim().length > 0)

    return {
        title: titleElement?.textContent.trim() ?? "",
        metaDescription: metaDesc?.getAttribute("content")?.trim() ?? "",
        url,
        canonicalUrl: canonical?.getAttribute("href") ?? null,
        headings: extractHeadings(doc, { dedupe: true }),
        images,
        links,
        textContent: bodyText,
        wordCount,
        firstParagraph: extractFirstParagraph(doc),
        openGraphData: extractOpenGraphData(doc),
        structuredData: extractStructuredData(doc),
        viewport: viewport?.getAttribute("content") ?? null,
        charset: charset?.getAttribute("charset") ?? null,
        language,
        robotsMeta: robotsMeta?.getAttribute("content") ?? null,
        // Enhanced data for AI analysis
        contentFeatures,
        bodyTextExcerpt,
        urlSegments,
        internalLinks,
        externalLinks,
        imageAlts,
    }
}

function analyzeKeywordUsage(data: ExtractedSEOData, keyword: string): SEOAnalysis["keywordStats"] {
    if (!keyword) return undefined

    const normalizedKeyword = normalizeText(keyword)
    const normalizedContent = normalizeText(data.textContent)
    const keywordCount = (normalizedContent.match(new RegExp(normalizedKeyword, "g")) ?? []).length

    return {
        density: (keywordCount / data.wordCount) * 100,
        count: keywordCount,
        positions: {
            title: normalizeText(data.title).includes(normalizedKeyword),
            metaDescription: normalizeText(data.metaDescription).includes(normalizedKeyword),
            headings: data.headings.filter(h => normalizeText(h.text).includes(normalizedKeyword)).map(h => h.index),
            firstParagraph: normalizeText(data.firstParagraph).includes(normalizedKeyword),
        },
    }
}

function performChecks(data: ExtractedSEOData, keyword: string, url: string): SEOCheck[] {
    const checks: SEOCheck[] = []

    // Basic SEO checks using new services
    checks.push(...validateFocusKeyword(keyword))
    checks.push(...validateTitle(data.title || "", url))
    checks.push(...validateMetaDescription(data.metaDescription || ""))
    checks.push(...validateH1(data.headings))
    checks.push(...validateHeadingHierarchy(data.headings))

    // Keyword placement checks
    checks.push(...performKeywordPlacementChecks(data, keyword))

    // Image alt text checks
    checks.push(...validateImageAlts(data.images))

    // Content quality checks
    checks.push(...validateContentLength(data.wordCount || 0))

    return checks
}

function performKeywordPlacementChecks(data: ExtractedSEOData, keyword: string): SEOCheck[] {
    const checks: SEOCheck[] = []

    if (!keyword) {
        // Only show the missing keyword check
        checks.push({
            id: "keyword-placement",
            name: "Keyword Placement",
            status: "warning",
            description: "Main Keyword is not set. Set it first to see the analysis",
            evidence: "No main keyword found to check for placement",
            importance: "high",
            category: "content",
            suggestions: ["Add a focus keyword", "Use it naturally in the content"],
        })
    } else {
        // Use new keyword matcher services
        const h1s = data.headings.filter(h => h.level === "h1")
        const allH1Texts = h1s.map(h => h.text)
        const firstH1 = h1s[0]?.text ?? ""

        const titleCheck = checkTitleHasKeyword(data.title || "", keyword)
        const metaCheck = checkMetaHasKeyword(data.metaDescription || "", keyword)
        const h1Check = checkH1HasKeyword(firstH1, keyword, allH1Texts)

        const titleSEOCheck = checkToSEOCheck(titleCheck, "kw-in-title", "Keyword in Title")
        const metaSEOCheck = checkToSEOCheck(metaCheck, "kw-in-meta", "Keyword in Meta")
        const h1SEOCheck = checkToSEOCheck(h1Check, "kw-in-h1", "Keyword in H1")

        keywordPlacementEvidence = {
            keyword,
            title: titleSEOCheck,
            meta: metaSEOCheck,
            h1: h1SEOCheck,
        }

        const allPass =
            titleSEOCheck.status === "pass" && metaSEOCheck.status === "pass" && h1SEOCheck.status === "pass"

        checks.push({
            id: "keyword-placement",
            name: "Keyword Placement",
            status: allPass ? "pass" : "warning",
            description: "Main Keyword is Set",
            evidence: JSON.stringify(keywordPlacementEvidence),
            importance: "high",
            category: "content",
            suggestions: [],
        })
    }

    return checks
}

function calculateScore(checks: SEOCheck[]): number {
    const weights = {
        high: { pass: 1, warning: 0.5, fail: 0, summary: 0 },
        medium: { pass: 1, warning: 0.7, fail: 0.3, summary: 0 },
        low: { pass: 1, warning: 0.8, fail: 0.5, summary: 0 },
    }

    let totalScore = 0
    let totalWeight = 0

    checks.forEach(check => {
        const weight = check.importance === "high" ? 3 : check.importance === "medium" ? 2 : 1
        totalWeight += weight
        totalScore += weight * weights[check.importance][check.status]
    })

    return Math.round((totalScore / totalWeight) * 100)
}

export const SEOService = {
    // Clear cache when deployment time changes
    clearHTMLCache(): void {
        htmlCache.clear()
    },

    fetchPageHTML,

    async analyzePage(
        url: string,
        focusKeyword = "",
        deploymentTimes?: { staging: number | null; production: number | null },
        pageId?: string
    ): Promise<SEOAnalysis> {
        // Ensure keyword is always a string (defensive programming)
        const safeKeyword = focusKeyword || ""

        // Fetch HTML content
        const html = await fetchPageHTML(url)

        // Analyze content
        const extractedData = extractSEOData(html, url)

        // Use ONLY Framer API images for this page (no HTML images)
        if (pageId) {
            extractedData.images = await FramerImageService.getPageImages(pageId)
        } else {
            // No pageId available → do not use HTML images
            extractedData.images = []
        }

        const checks = performChecks(extractedData, safeKeyword, url)
        const score = calculateScore(checks)
        const keywordStats = analyzeKeywordUsage(extractedData, safeKeyword)

        // Only store deployment times if they have actual values
        const hasValidTimes =
            deploymentTimes && (deploymentTimes.staging !== null || deploymentTimes.production !== null)
        const timesToStore = hasValidTimes ? deploymentTimes : undefined

        return {
            pageId: url,
            score,
            focusKeyword,
            checks,
            publishedUrl: url,
            extractedData,
            pageAnalyzedOnDeploymentTime: timesToStore,
            keywordStats,
        }
    },
}
