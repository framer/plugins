import type { HeadingIssue, SEOCheck, SEOHeading, SEOImage } from "../../types/seo"

/**
 * Focus keyword validation and checks
 */
export function validateFocusKeyword(keyword: string): SEOCheck[] {
    const checks: SEOCheck[] = []

    if (!keyword) {
        checks.push({
            id: "main-keyword",
            name: "Main Keyword",
            status: "warning",
            description: "Main Keyword is not set",
            evidence: "No main keyword found",
            importance: "medium",
            category: "content",
            suggestions: ["Add a focus keyword", "Use it naturally in the content"],
        })
    } else {
        checks.push({
            id: "main-keyword",
            name: "Main Keyword",
            status: "pass",
            description: "Main Keyword is set",
            evidence: keyword,
            importance: "medium",
            category: "content",
            suggestions: [],
        })
    }

    return checks
}

/**
 * Title validation and checks
 */
export function validateTitle(title: string, url: string): SEOCheck[] {
    const checks: SEOCheck[] = []

    function getPageName(url: string): string {
        const { pathname } = new URL(url)
        return pathname === "/" ? "home" : pathname.slice(1)
    }

    const pageName = getPageName(url)

    if (!title) {
        checks.push({
            id: "page-title",
            name: "Page Title",
            status: "fail",
            description: "Page Title is missing",
            evidence: "No Page Title found",
            importance: "high",
            category: "technical",
            suggestions: ["Add a page title", "Keep it under 60 characters", "Include your main keyword"],
        })
    } else if (title.toLowerCase() === pageName.toLowerCase()) {
        checks.push({
            id: "page-title",
            name: "Page Title",
            status: "fail",
            description: `Page Title is the same as the page name: ${title}`,
            evidence: title,
            importance: "high",
            category: "technical",
            suggestions: ["Change the Page Title to a more descriptive title"],
        })
    } else {
        checks.push({
            id: "page-title",
            name: "Page Title",
            status: "pass",
            description: "Page Title is present",
            evidence: title,
            importance: "high",
            category: "technical",
            suggestions: [],
        })
    }

    return checks
}

/**
 * Meta description validation and checks
 */
export function validateMetaDescription(metaDescription: string): SEOCheck[] {
    const checks: SEOCheck[] = []

    if (!metaDescription) {
        checks.push({
            id: "page-description",
            name: "Page Description",
            status: "fail",
            description: "Page Description is missing",
            evidence: "No page description found",
            importance: "high",
            category: "technical",
            suggestions: ["Add a meta description", "Keep it under 160 characters", "Include your main keyword"],
        })
    } else {
        checks.push({
            id: "page-description",
            name: "Page Description",
            status: "pass",
            description: "Page Description is present",
            evidence: metaDescription,
            importance: "high",
            category: "technical",
            suggestions: [],
        })
    }

    return checks
}

/**
 * H1 validation and checks
 */
export function validateH1(headings: SEOHeading[]): SEOCheck[] {
    const checks: SEOCheck[] = []
    const h1s = headings.filter(h => h.level === "h1")

    if (h1s.length === 0) {
        checks.push({
            id: "h1-check",
            name: "H1 Heading",
            status: "fail",
            description: "H1 Heading is missing",
            evidence: "No H1 found",
            importance: "high",
            category: "technical",
            suggestions: ["Add an H1 heading", "Use it to describe the main topic", "Include your main keyword"],
        })
    } else if (h1s.length === 1) {
        checks.push({
            id: "h1-check",
            name: "H1 Heading",
            status: "pass",
            description: "H1 Heading is present",
            evidence: h1s[0]?.text ?? "",
            importance: "high",
            category: "technical",
            suggestions: [],
        })
    } else if (h1s.length > 1) {
        checks.push({
            id: "h1-check",
            name: "H1 Heading",
            status: "warning",
            description: `Multiple H1 Headings found. Only one is allowed per page`,
            evidence: h1s.map(h => h.text).join(", "),
            importance: "high",
            category: "technical",
            suggestions: [],
        })
    }

    return checks
}

/**
 * Heading hierarchy validation and checks
 */
export function validateHeadingHierarchy(headings: SEOHeading[]): SEOCheck[] {
    const checks: SEOCheck[] = []
    const issues = detectAllHeadingIssues(headings)

    if (issues.length === 0) {
        checks.push({
            id: "hierarchy-check",
            name: "H1-H6 Hierarchy",
            status: "pass",
            description: "H1-H6 Heading structure is logical",
            evidence: JSON.stringify(issues),
            importance: "high",
            category: "technical",
            suggestions: [],
        })
    } else {
        checks.push({
            id: "hierarchy-check",
            name: "H1-H6 Hierarchy",
            status: issues.some(i => i.severity === "error") ? "fail" : "warning",
            description: `Found ${issues.length} Heading Hierarchy issue${issues.length > 1 ? "s" : ""}`,
            evidence: JSON.stringify(issues),
            importance: "high",
            category: "technical",
            suggestions: ["Review heading hierarchy issues below"],
        })
    }

    return checks
}

/**
 * Content length validation and checks
 */
export function validateContentLength(contentLength: number): SEOCheck[] {
    const checks: SEOCheck[] = []

    if (contentLength < 300) {
        checks.push({
            id: "content-length",
            name: "Content Length",
            status: "warning",
            description: `Content is too short (${contentLength} words). Recommended: 300+ words`,
            evidence: `${contentLength} words`,
            importance: "medium",
            category: "content",
            suggestions: ["Add more content", "Expand on your main topic", "Include more details and examples"],
        })
    } else if (contentLength > 2500) {
        checks.push({
            id: "content-length",
            name: "Content Length",
            status: "warning",
            description: `Content is very long (${contentLength} words). Consider breaking into multiple pages`,
            evidence: `${contentLength} words`,
            importance: "low",
            category: "content",
            suggestions: ["Consider breaking into multiple pages", "Use subheadings to organize content"],
        })
    } else {
        checks.push({
            id: "content-length",
            name: "Content Length",
            status: "pass",
            description: `Content length is good (${contentLength} words)`,
            evidence: `${contentLength} words`,
            importance: "medium",
            category: "content",
            suggestions: [],
        })
    }

    return checks
}

/**
 * Image alt text validation and checks
 */
export function validateImageAlts(images: SEOImage[]): SEOCheck[] {
    const checks: SEOCheck[] = []

    // Build unique images by normalized src (ignore query/hash), so duplicates count once
    const normalizeSrc = (src: string | null | undefined): string => {
        if (!src) return ""
        try {
            const u = new URL(src, "http://example.com")
            return (u.origin + u.pathname).toLowerCase()
        } catch {
            return (src.split("?")[0]?.split("#")[0] ?? src).toLowerCase()
        }
    }

    const uniqueMap = new Map<string, SEOImage>()
    for (const img of images) {
        const key = normalizeSrc(img.src)
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, img)
        }
    }

    const uniqueImages = Array.from(uniqueMap.values())
    const totalImages = uniqueImages.length
    const imagesWithAlt = uniqueImages.filter(img => !!img.alt && img.alt.trim().length > 0).length
    const imagesWithoutAlt = totalImages - imagesWithAlt

    // Calculate percentage
    const percentageWithAlt = totalImages > 0 ? (imagesWithAlt / totalImages) * 100 : 100

    // Create evidence object
    const evidence = JSON.stringify({
        total: totalImages,
        withAlt: imagesWithAlt,
        withoutAlt: imagesWithoutAlt,
        percentage: Math.round(percentageWithAlt),
    })

    if (totalImages === 0) {
        checks.push({
            id: "image-alts",
            name: "Image Alts",
            status: "pass",
            description: "No images found on this page",
            evidence,
            importance: "medium",
            category: "images",
            suggestions: [],
        })
    } else if (percentageWithAlt > 80) {
        checks.push({
            id: "image-alts",
            name: "Image Alts",
            status: "pass",
            description: `${imagesWithAlt} of ${totalImages} images have alt text (${Math.round(percentageWithAlt)}%)`,
            evidence,
            importance: "medium",
            category: "images",
            suggestions: [],
        })
    } else if (percentageWithAlt >= 50) {
        checks.push({
            id: "image-alts",
            name: "Image Alts",
            status: "warning",
            description: `Only ${imagesWithAlt} of ${totalImages} images have alt text (${Math.round(percentageWithAlt)}%)`,
            evidence,
            importance: "medium",
            category: "images",
            suggestions: [
                "Add alt text to images",
                "Describe what the image shows",
                "Keep alt text concise and descriptive",
            ],
        })
    } else {
        checks.push({
            id: "image-alts",
            name: "Image Alts",
            status: "fail",
            description: `Only ${imagesWithAlt} of ${totalImages} images have alt text (${Math.round(percentageWithAlt)}%)`,
            evidence,
            importance: "medium",
            category: "images",
            suggestions: [
                "Add alt text to all images",
                "Alt text is important for accessibility",
                "Alt text helps search engines understand images",
            ],
        })
    }

    return checks
}

/**
 * Heading hierarchy issue detection functions
 */

function detectHeadingJumps(headings: SEOHeading[]): HeadingIssue[] {
    const issues: HeadingIssue[] = []

    for (let i = 1; i < headings.length; i++) {
        const prev = headings[i - 1]
        const current = headings[i]
        if (!prev || !current) continue
        const prevLevel = parseInt(prev.level.charAt(1))
        const currentLevel = parseInt(current.level.charAt(1))

        if (currentLevel > prevLevel + 1) {
            issues.push({
                type: "jump",
                level: current.level,
                index: current.index,
                text: current.text,
                previousHeading: {
                    level: prev.level,
                    text: prev.text,
                    index: prev.index,
                },
                severity: "warning",
            })
        }
    }

    return issues
}

function detectMissingLevels(headings: SEOHeading[]): HeadingIssue[] {
    const issues: HeadingIssue[] = []
    const hasLevels = { h1: false, h2: false, h3: false, h4: false, h5: false, h6: false }

    headings.forEach(h => (hasLevels[h.level] = true))

    // Check each heading that exists without its prerequisite
    if (hasLevels.h3 && !hasLevels.h2) {
        headings
            .filter(h => h.level === "h3")
            .forEach(h3 => {
                issues.push({
                    type: "missing_level",
                    level: "h3",
                    index: h3.index,
                    text: h3.text,
                    missingLevel: "h2",
                    severity: "warning",
                })
            })
    }

    if (hasLevels.h4 && !hasLevels.h3) {
        headings
            .filter(h => h.level === "h4")
            .forEach(h4 => {
                issues.push({
                    type: "missing_level",
                    level: "h4",
                    index: h4.index,
                    text: h4.text,
                    missingLevel: "h3",
                    severity: "warning",
                })
            })
    }

    if (hasLevels.h5 && !hasLevels.h4) {
        headings
            .filter(h => h.level === "h5")
            .forEach(h5 => {
                issues.push({
                    type: "missing_level",
                    level: "h5",
                    index: h5.index,
                    text: h5.text,
                    missingLevel: "h4",
                    severity: "warning",
                })
            })
    }

    if (hasLevels.h6 && !hasLevels.h5) {
        headings
            .filter(h => h.level === "h6")
            .forEach(h6 => {
                issues.push({
                    type: "missing_level",
                    level: "h6",
                    index: h6.index,
                    text: h6.text,
                    missingLevel: "h5",
                    severity: "warning",
                })
            })
    }

    return issues
}

function detectMultipleH1s(headings: SEOHeading[]): HeadingIssue[] {
    const h1s = headings.filter(h => h.level === "h1")

    if (h1s.length > 1) {
        return h1s.map(h1 => ({
            type: "multiple_h1" as const,
            level: "h1",
            index: h1.index,
            text: h1.text,
            severity: "warning" as const,
        }))
    }

    return []
}

export function detectAllHeadingIssues(headings: SEOHeading[]): HeadingIssue[] {
    const issues: HeadingIssue[] = []

    // Check for missing H1
    const h1Count = headings.filter(h => h.level === "h1").length
    if (h1Count === 0) {
        issues.push({
            type: "missing_h1",
            level: "h1",
            index: -1,
            text: "No H1 found",
            severity: "error",
        })
    }

    // Detect all issue types
    issues.push(...detectMultipleH1s(headings))
    issues.push(...detectHeadingJumps(headings))
    issues.push(...detectMissingLevels(headings))

    return issues
}
