import type { SEOAnalysis } from "../types/seo"

export type DeploymentTimes = { staging: number | null; production: number | null } | undefined

export interface AnalysisState {
    url: string | null | undefined
    keyword: string
    times: DeploymentTimes
}

export interface AnalysisDecision {
    needsAnalysis: boolean
    reasons: ("initial" | "url" | "keyword" | "deploymentTime")[]
}

export function computeAnalysisDecision(prev: AnalysisState | null, next: AnalysisState): AnalysisDecision {
    const reasons: AnalysisDecision["reasons"] = []

    if (!prev?.url) {
        reasons.push("initial")
        return { needsAnalysis: true, reasons }
    }

    if (prev.url !== next.url) reasons.push("url")
    if (prev.keyword !== next.keyword) reasons.push("keyword")

    const prevTimes = prev.times
    const nextTimes = next.times

    const timesChanged = !sameTimes(prevTimes, nextTimes)
    if (timesChanged) reasons.push("deploymentTime")

    return { needsAnalysis: reasons.length > 0, reasons }
}

export function sameTimes(a: DeploymentTimes, b: DeploymentTimes): boolean {
    if (!a || !b) return false
    return a.staging === b.staging && a.production === b.production
}

// --- Simple in-memory state cache (persists while plugin is open) ---
const analyzedStateCache = new Map<string, AnalysisState>()

export function getCachedState(url: string | null | undefined): AnalysisState | null {
    if (!url) return null
    return analyzedStateCache.get(url) ?? null
}

export function setCachedState(state: AnalysisState): void {
    if (!state.url) return
    analyzedStateCache.set(state.url, state)
}

// --- Full analysis result cache (by URL + keyword + deployment time with TTL) ---
interface CachedAnalysis {
    result: SEOAnalysis
    timestamp: number
}

const ANALYSIS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const analysisResultCache = new Map<string, CachedAnalysis>()

// Generate composite cache key from URL, keyword, and deployment times
function getCacheKey(url: string, keyword = "", times: DeploymentTimes = undefined): string {
    const staging = times?.staging ?? 0
    const production = times?.production ?? 0
    return `${url}|${keyword}|${staging}|${production}`
}

export function getCachedAnalysis(
    url: string | null | undefined,
    keyword = "",
    times: DeploymentTimes = undefined
): SEOAnalysis | null {
    if (!url) return null

    const cacheKey = getCacheKey(url, keyword, times)
    const cached = analysisResultCache.get(cacheKey)
    if (!cached) return null

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp
    if (age > ANALYSIS_CACHE_TTL) {
        analysisResultCache.delete(cacheKey)
        return null
    }

    return cached.result
}

export function setCachedAnalysis(
    url: string | null | undefined,
    keyword: string,
    times: DeploymentTimes,
    analysis: SEOAnalysis
): void {
    if (!url) return

    const cacheKey = getCacheKey(url, keyword, times)
    analysisResultCache.set(cacheKey, {
        result: analysis,
        timestamp: Date.now(),
    })

    // Cleanup old entries (prevent memory leaks)
    if (analysisResultCache.size > 30) {
        const entries = Array.from(analysisResultCache.entries())
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
        const oldest = entries[0]
        if (oldest) analysisResultCache.delete(oldest[0])
    }
}

// Add function to clear analysis cache
export function clearAnalysisCache(): void {
    analysisResultCache.clear()
}
