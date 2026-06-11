export interface SEOHeading {
    level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
    text: string
    index: number
    visible: boolean
    id?: string
    parent?: string
    duplicateOf?: number
    hasIssue?: boolean
    issueType?: "jump" | "missing_level" | "multiple_h1" | "missing_h1"
}

export interface HeadingIssue {
    type: "jump" | "missing_level" | "missing_h1" | "multiple_h1"
    level: string
    index: number
    text: string
    previousHeading?: { level: string; text: string; index: number }
    missingLevel?: string
    severity: "error" | "warning"
}

export interface SEOImage {
    src: string
    alt: string | null
    width?: number
    height?: number
    loading?: string
    nodeId?: string // Framer node ID for updating alt text
    isLocked?: boolean // Whether the node is locked/protected in Framer
}

export interface SEOLink {
    href: string
    text: string
    isInternal: boolean
    isNofollow: boolean
}

export interface ExtractedSEOData {
    title: string
    metaDescription: string
    url: string
    canonicalUrl: string | null
    headings: SEOHeading[]
    images: SEOImage[]
    links: SEOLink[]
    textContent: string
    wordCount: number
    firstParagraph: string
    openGraphData: {
        title?: string
        description?: string
        image?: string
        type?: string
    }
    structuredData: unknown[]
    viewport: string | null
    charset: string | null
    language: string | null
    robotsMeta: string | null
    // Enhanced data for AI analysis
    contentFeatures?: {
        lists: number
        tables: number
        faqs: number
        blockquotes: number
        codeBlocks: number
    }
    bodyTextExcerpt?: string
    urlSegments?: string[]
    internalLinks?: SEOLink[]
    externalLinks?: SEOLink[]
    imageAlts?: string[]
}

export interface SEOCheck {
    id: string
    name: string
    status: "pass" | "fail" | "warning" | "summary"
    description: string
    evidence: string
    importance: "high" | "medium" | "low"
    category: "technical" | "content" | "meta" | "headings" | "images" | "links"
    suggestions?: string[]
}

export interface SEOAnalysis {
    pageId: string
    score: number
    focusKeyword: string
    checks: SEOCheck[]
    publishedUrl?: string
    extractedData: ExtractedSEOData
    pageAnalyzedOnDeploymentTime?: {
        staging: number | null
        production: number | null
    }
    keywordStats?: {
        density: number
        count: number
        positions: {
            title: boolean
            metaDescription: boolean
            headings: number[]
            firstParagraph: boolean
        }
    }
    duplicatePages?: {
        title: string[]
        metaDescription: string[]
    }
}
