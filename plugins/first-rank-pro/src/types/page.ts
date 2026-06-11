export interface Page {
    id: string
    name: string
    url?: string
    category?: string
}

// Use the SDK's own publish-info type so it can never drift from the API.
export type { PublishInfo } from "framer-plugin"

export interface PageData {
    // Core SEO data (frequently accessed)
    core: {
        focusKeyword: string
        lastUpdated: number // Unix timestamp
    }

    // Analysis summary for quick home page display
    analysisSummary?: {
        counts: {
            pass: number
            fail: number
            warning: number
        }
        score: number
        lastAnalyzedAt: number // Unix timestamp
        deploymentTimes: {
            staging: number | null
            production: number | null
        }
    }

    // Data version for future migrations
    version: string
}

// AI suggestions stored in localStorage (non-critical data)
export interface AISuggestions {
    keyword?: string[]
    title?: string[]
    meta?: string[]
    h1?: string[]
    lastGeneratedAt: number // Unix timestamp
}
