import { useCallback, useEffect, useRef, useState } from "react"
import {
    type AnalysisState,
    clearAnalysisCache,
    computeAnalysisDecision,
    getCachedAnalysis,
    getCachedState,
    sameTimes,
    setCachedAnalysis,
    setCachedState,
} from "../lib/analysisCache"
import { PageDataService } from "../services/pageDataService"
import { SEOService } from "../services/seoService"
import type { Page } from "../types/page"
import type { SEOAnalysis } from "../types/seo"

export function useSEOAnalysis(
    page: Page | null,
    focusKeyword = "",
    deploymentTimes?: { staging: number | null; production: number | null }
) {
    const [analysis, setAnalysis] = useState<SEOAnalysis | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Persist last analyzed across mounts via in-memory cache
    const lastAnalyzed = useRef<AnalysisState | null>(null)
    const analysisInProgress = useRef(false)

    // Initialize from caches at mount / URL change
    // Cache Restoration - ONLY restore state, let decision logic handle analysis display
    useEffect(() => {
        // If no page, return
        if (!page?.url) return

        // If analysis is already in progress, skip cache restore
        if (analysisInProgress.current) {
            return
        }

        // Restore last analyzed state from cache (for decision logic)
        const cachedState = getCachedState(page.url)
        if (cachedState) {
            //     url: cachedState.url,
            //     times: cachedState.times
            // })
            lastAnalyzed.current = cachedState
        }

        // Don't set analysis here - let the main decision logic handle it
        // This fixes the race condition where restoration happens before decision logic
    }, [page?.url])

    const analyzePage = useCallback(
        async (url: string, keyword: string) => {
            // If analysis is already in progress, skip
            if (analysisInProgress.current) {
                return
            }

            // Clear both HTML and analysis caches if deployment time changed
            const cachedState = getCachedState(url)
            if (cachedState && !sameTimes(cachedState.times, deploymentTimes)) {
                SEOService.clearHTMLCache()
                clearAnalysisCache()
            }

            // Set analysis in progress
            analysisInProgress.current = true
            setLoading(true)
            setError(null)

            //     url,
            //     keyword,
            //     deploymentTimes,
            //     pageId: page?.id
            // })

            try {
                const result = await SEOService.analyzePage(url, keyword || "", deploymentTimes, page?.id)

                // Set and cache the new analysis with composite key (url + keyword + times)
                setAnalysis(result)
                setCachedAnalysis(url, keyword, deploymentTimes, result)

                // Save analysis summary to Framer storage
                if (page?.id && deploymentTimes) {
                    await PageDataService.updateAnalysisSummary(page.id, result.checks, result.score, deploymentTimes)
                }

                // Update state cache with new times
                const state: AnalysisState = { url, keyword, times: deploymentTimes }
                lastAnalyzed.current = state
                setCachedState(state)
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to analyze page")
                setAnalysis(null)
            } finally {
                analysisInProgress.current = false
                setLoading(false)
            }
        },
        [deploymentTimes, page?.id]
    )

    useEffect(() => {
        const next: AnalysisState = {
            url: page?.url,
            keyword: focusKeyword,
            times: deploymentTimes,
        }
        if (!next.url) return

        if (analysisInProgress.current) {
            return
        }

        const decision = computeAnalysisDecision(lastAnalyzed.current, next)
        //     prev: {
        //         url: lastAnalyzed.current?.url,
        //         times: lastAnalyzed.current?.times
        //     },
        //     next: {
        //         url: next.url,
        //         times: next.times
        //     },
        //     decision
        // })

        if (!decision.needsAnalysis) {
            // Even if decision says no analysis needed, check if cache is still valid
            const cachedAnalysis = getCachedAnalysis(next.url, next.keyword, next.times)
            if (!cachedAnalysis) {
                void analyzePage(next.url, next.keyword)
                return
            }
            // Cache hit - restore the cached analysis
            setAnalysis(cachedAnalysis)
            return
        }

        void analyzePage(next.url, next.keyword)
    }, [page?.url, deploymentTimes, analyzePage, focusKeyword]) // ✅ Added focusKeyword to dependencies

    // Manual trigger for keyword analysis
    const triggerKeywordAnalysis = useCallback(
        async (keyword: string) => {
            if (!page?.url) return
            await analyzePage(page.url, keyword)
        },
        [page?.url, analyzePage]
    )

    return {
        analysis,
        loading,
        error,
        updatePageContent: async () => Promise.resolve(),
        triggerKeywordAnalysis, // ✅ New manual trigger function
    }
}
