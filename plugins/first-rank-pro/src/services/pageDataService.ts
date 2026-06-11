import { framer } from "framer-plugin"
import type { AISuggestions, PageData } from "../types/page"
import type { SEOCheck } from "../types/seo"
import { deleteProjectData, getProjectData, getProjectDataKeys, setProjectData } from "./framerStorage"

const CURRENT_VERSION = "1.0"

// Shape of data written by older plugin versions, parsed from storage.
interface LegacyAISuggestions {
    keyword?: string[]
    title?: string[]
    meta?: string[]
    h1?: string[]
    lastGeneratedAt?: string | number
}

interface LegacyPageData {
    core?: { focusKeyword?: string; lastUpdated?: string | number }
    analysisSummary?: PageData["analysisSummary"]
    aiSuggestions?: LegacyAISuggestions
}

let projectIdCache: string | null = null

// Get a unique project identifier from staging URL (fallback to production)
async function getProjectIdentifier(): Promise<string> {
    if (projectIdCache) return projectIdCache

    try {
        const publishInfo = await framer.getPublishInfo()
        const productionUrl = publishInfo.production?.url
        const stagingUrl = publishInfo.staging?.url

        // Try staging URL first, then production
        const projectUrl = stagingUrl ?? productionUrl

        if (projectUrl) {
            // Create a stable hash from URL
            const hash = btoa(projectUrl)
                .replace(/[^a-zA-Z0-9]/g, "")
                .substring(0, 16)
            projectIdCache = hash
            return hash
        }
    } catch {
        // Publish info unavailable; fall through to the session-scoped fallback id.
    }

    // Fallback to timestamp-based ID (will be different per session)
    const fallbackId = `project-${String(Date.now())}`
    projectIdCache = fallbackId
    return fallbackId
}

// Generate unique storage key per project and page
async function getStorageKey(pageId: string): Promise<string> {
    const projectId = await getProjectIdentifier()
    return `first-rank-${projectId}-${pageId}`
}

// Generate localStorage key for AI suggestions
async function getAISuggestionsKey(pageId: string): Promise<string> {
    const projectId = await getProjectIdentifier()
    return `ai-suggestions-${projectId}-${pageId}`
}

export const PageDataService = {
    // Save AI suggestions to localStorage
    async saveAISuggestionsToLocal(pageId: string, suggestions: Partial<AISuggestions>): Promise<void> {
        const key = await getAISuggestionsKey(pageId)

        // Load existing suggestions
        const existing = await PageDataService.getAISuggestionsFromLocal(pageId)

        // Merge with new suggestions
        const updated: AISuggestions = {
            ...existing,
            ...suggestions,
            lastGeneratedAt: Date.now(),
        }

        localStorage.setItem(key, JSON.stringify(updated))
    },

    // Get AI suggestions from localStorage
    async getAISuggestionsFromLocal(pageId: string): Promise<AISuggestions | null> {
        try {
            const key = await getAISuggestionsKey(pageId)
            const saved = localStorage.getItem(key)

            if (!saved) {
                return null
            }

            return JSON.parse(saved) as AISuggestions
        } catch {
            return null
        }
    },

    // Delete AI suggestions from localStorage
    async deleteAISuggestionsFromLocal(pageId: string): Promise<void> {
        try {
            const key = await getAISuggestionsKey(pageId)
            localStorage.removeItem(key)
        } catch {
            // localStorage may be unavailable; deleting suggestions is best-effort.
        }
    },

    // Load unified page data
    async loadPageData(pageId: string): Promise<PageData | null> {
        try {
            const storageKey = await getStorageKey(pageId)
            const saved = await getProjectData(storageKey)

            if (!saved) {
                return null
            }

            return JSON.parse(saved) as PageData
        } catch {
            return null
        }
    },

    // Save unified page data
    async savePageData(pageId: string, data: PageData): Promise<void> {
        const storageKey = await getStorageKey(pageId)
        const payload = JSON.stringify(data)
        await setProjectData(storageKey, payload)
    },

    // Update only core data (focus keyword)
    async updateCoreData(pageId: string, coreData: Partial<PageData["core"]>): Promise<void> {
        const existing = await PageDataService.loadPageData(pageId)
        const updated: PageData = {
            version: CURRENT_VERSION,
            core: {
                focusKeyword: "",
                lastUpdated: Date.now(),
                ...existing?.core,
                ...coreData,
            },
            analysisSummary: existing?.analysisSummary,
        }

        // Always update the lastUpdated timestamp
        updated.core.lastUpdated = Date.now()

        await PageDataService.savePageData(pageId, updated)
    },

    // Update only AI suggestions (now in localStorage)
    async updateAISuggestions(pageId: string, suggestions: Partial<AISuggestions>): Promise<void> {
        await PageDataService.saveAISuggestionsToLocal(pageId, suggestions)
    },

    // Get only core data (for focus keyword)
    async getCoreData(pageId: string): Promise<PageData["core"] | null> {
        const pageData = await PageDataService.loadPageData(pageId)
        return pageData?.core ?? null
    },

    // Get only AI suggestions (now from localStorage)
    async getAISuggestions(pageId: string): Promise<AISuggestions | null> {
        return await PageDataService.getAISuggestionsFromLocal(pageId)
    },

    // Update analysis summary (called after SEO analysis completes)
    async updateAnalysisSummary(
        pageId: string,
        checks: SEOCheck[],
        score: number,
        deploymentTimes: { staging: number | null; production: number | null }
    ): Promise<void> {
        const existing = await PageDataService.loadPageData(pageId)

        // Count pass, fail, warning from checks (excluding 'summary' status)
        const counts = checks.reduce(
            (acc, check) => {
                if (check.status === "pass") acc.pass++
                else if (check.status === "fail") acc.fail++
                else if (check.status === "warning") acc.warning++
                return acc
            },
            { pass: 0, fail: 0, warning: 0 }
        )

        const updated: PageData = {
            version: CURRENT_VERSION,
            core: existing?.core ?? {
                focusKeyword: "",
                lastUpdated: Date.now(),
            },
            analysisSummary: {
                counts,
                score,
                lastAnalyzedAt: Date.now(),
                deploymentTimes,
            },
        }

        await PageDataService.savePageData(pageId, updated)
    },

    // Get only analysis summary (for home page display)
    async getAnalysisSummary(pageId: string): Promise<PageData["analysisSummary"] | null> {
        const pageData = await PageDataService.loadPageData(pageId)
        return pageData?.analysisSummary ?? null
    },

    // Check if analysis is stale (deployment times changed)
    async isAnalysisStale(
        pageId: string,
        currentDeploymentTimes: { staging: number | null; production: number | null }
    ): Promise<boolean> {
        const summary = await PageDataService.getAnalysisSummary(pageId)

        if (!summary) return true // No analysis yet

        return (
            summary.deploymentTimes.staging !== currentDeploymentTimes.staging ||
            summary.deploymentTimes.production !== currentDeploymentTimes.production
        )
    },

    /**
     * Migrate data from old structure to new optimized structure
     * - Migrates frame-rank keys to first-rank keys
     * - Moves AI suggestions from Framer storage to localStorage
     * Call this once during app initialization
     */
    async migrateOldData(): Promise<void> {
        try {
            const allKeys = await getProjectDataKeys()
            const oldKeys = allKeys.filter(k => k.startsWith("frame-rank-") || k.startsWith("first-rank-"))

            for (const key of oldKeys) {
                // Get data
                const dataStr = await getProjectData(key)
                if (!dataStr) continue

                try {
                    const data = JSON.parse(dataStr) as LegacyPageData

                    // Extract pageId from key (last segment after last dash)
                    const pageId = key.split("-").at(-1)

                    if (!pageId) continue

                    // Check if data has old structure (with aiSuggestions field)
                    if (data.aiSuggestions) {
                        // Move AI suggestions to localStorage
                        const legacy = data.aiSuggestions
                        const aiSuggestions: AISuggestions = {
                            keyword: legacy.keyword,
                            title: legacy.title,
                            meta: legacy.meta,
                            h1: legacy.h1,
                            lastGeneratedAt:
                                typeof legacy.lastGeneratedAt === "string"
                                    ? new Date(legacy.lastGeneratedAt).getTime()
                                    : (legacy.lastGeneratedAt ?? Date.now()),
                        }

                        await PageDataService.saveAISuggestionsToLocal(pageId, aiSuggestions)

                        // Create new structure without aiSuggestions
                        const newData: PageData = {
                            version: CURRENT_VERSION,
                            core: {
                                focusKeyword: data.core?.focusKeyword ?? "",
                                lastUpdated:
                                    typeof data.core?.lastUpdated === "string"
                                        ? new Date(data.core.lastUpdated).getTime()
                                        : (data.core?.lastUpdated ?? Date.now()),
                            },
                            analysisSummary: data.analysisSummary,
                        }

                        // Update with new structure
                        const newKey = key.startsWith("frame-rank-") ? key.replace("frame-rank-", "first-rank-") : key

                        await setProjectData(newKey, JSON.stringify(newData))

                        // Delete old key if it was frame-rank
                        if (key.startsWith("frame-rank-")) {
                            await deleteProjectData(key)
                        }
                    } else if (key.startsWith("frame-rank-")) {
                        // Just rename frame-rank to first-rank if no structure changes needed
                        const newKey = key.replace("frame-rank-", "first-rank-")
                        await setProjectData(newKey, dataStr)
                        await deleteProjectData(key)
                    }
                } catch {
                    // Skip entries that fail to parse; migration is best-effort.
                }
            }
        } catch {
            // Migration is best-effort; never block plugin startup on it.
        }
    },
}
