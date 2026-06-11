import { useCallback, useEffect, useState } from "react"
import { type AIGenerateType, AIService } from "../services/aiService"
import { PageDataService } from "../services/pageDataService"
import type { ExtractedSEOData } from "../types/seo"

interface SuggestionsState {
    keyword?: string[]
    title?: string[]
    meta?: string[]
    h1?: string[]
}

interface AIGenerationState {
    generating: Record<AIGenerateType, boolean>
    error: string | null
    suggestions: SuggestionsState
}

export interface UseAIGenerationReturn {
    generating: Record<AIGenerateType, boolean>
    error: string | null
    suggestions: SuggestionsState
    generate: (type: AIGenerateType, pageName?: string) => Promise<string[]>
    clearError: () => void
}

export function useAIGeneration(
    pageId: string,
    url: string,
    extractedData: ExtractedSEOData | null,
    focusKeyword?: string
): UseAIGenerationReturn {
    const [state, setState] = useState<AIGenerationState>({
        generating: { keyword: false, title: false, meta: false, h1: false },
        error: null,
        suggestions: {},
    })

    // Load cached suggestions on mount
    useEffect(() => {
        if (!pageId) return

        const loadCached = async () => {
            try {
                const aiSuggestions = await PageDataService.getAISuggestions(pageId)
                if (aiSuggestions) {
                    const suggestions = {
                        keyword: aiSuggestions.keyword,
                        title: aiSuggestions.title,
                        meta: aiSuggestions.meta,
                        h1: aiSuggestions.h1,
                    }
                    setState(prev => ({ ...prev, suggestions }))
                }
            } catch {
                // Cached suggestions are best-effort.
            }
        }
        void loadCached()
    }, [pageId])

    const persist = useCallback(
        async (suggestions: SuggestionsState) => {
            try {
                await PageDataService.updateAISuggestions(pageId, suggestions)
            } catch {
                // Persisting suggestions is best-effort.
            }
        },
        [pageId]
    )

    const generate = useCallback(
        async (type: AIGenerateType, pageName?: string): Promise<string[]> => {
            // Guard against missing data
            if (!extractedData || !url) {
                const errorMsg = "Page data not available yet. Please wait for analysis to complete."
                setState(prev => ({ ...prev, error: errorMsg }))
                throw new Error(errorMsg)
            }

            setState(prev => ({
                ...prev,
                generating: { ...prev.generating, [type]: true },
                error: null,
            }))

            try {
                const response = await AIService.generate({
                    type,
                    url,
                    focusKeyword,
                    pageName,
                    extractedData: {
                        title: extractedData.title || "",
                        metaDescription: extractedData.metaDescription || "",
                        headings: extractedData.headings.map(h => ({
                            level: h.level,
                            text: h.text,
                        })),
                        firstParagraph: extractedData.firstParagraph || "",
                        wordCount: extractedData.wordCount || 0,
                        openGraphData: extractedData.openGraphData,
                        // Enhanced data for better AI context
                        bodyTextExcerpt: extractedData.bodyTextExcerpt,
                        urlSegments: extractedData.urlSegments,
                        structuredData: extractedData.structuredData,
                        links:
                            extractedData.internalLinks && extractedData.externalLinks
                                ? {
                                      internal: extractedData.internalLinks.map(link => ({
                                          href: link.href,
                                          text: link.text,
                                          isNofollow: link.isNofollow,
                                      })),
                                      external: extractedData.externalLinks.map(link => ({
                                          href: link.href,
                                          text: link.text,
                                          isNofollow: link.isNofollow,
                                      })),
                                  }
                                : undefined,
                        imageAlts: extractedData.imageAlts,
                        contentFeatures: extractedData.contentFeatures,
                    },
                })

                // Update state with new suggestions
                const newSuggestions = {
                    ...state.suggestions,
                    [type]: response.items,
                }

                setState(prev => ({
                    ...prev,
                    generating: { ...prev.generating, [type]: false },
                    suggestions: newSuggestions,
                }))

                // Persist to storage with proper error handling
                try {
                    await persist(newSuggestions)
                } catch (persistError) {
                    // Update error state to inform user that suggestions might not persist
                    setState(prev => ({
                        ...prev,
                        error: "Suggestions generated but failed to save. They may be lost on refresh.",
                    }))
                }

                return response.items
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Failed to generate suggestions"

                setState(prev => ({
                    ...prev,
                    generating: { ...prev.generating, [type]: false },
                    error: errorMessage,
                }))

                throw error
            }
        },
        [url, focusKeyword, extractedData, persist, state.suggestions]
    )

    const clearError = useCallback(() => {
        setState(prev => ({ ...prev, error: null }))
    }, [])

    return {
        generating: state.generating,
        error: state.error,
        suggestions: state.suggestions,
        generate,
        clearError,
    }
}
