export type AIGenerateType = "keyword" | "title" | "meta" | "h1"

export interface AltTextGenerateResponse {
    altText: string
    model: "gemini" | "gpt-4o-mini"
}

export interface AIGenerateRequest {
    type: AIGenerateType
    url: string
    focusKeyword?: string
    extractedData: {
        title: string
        metaDescription: string
        headings: { level: string; text: string }[]
        firstParagraph: string
        wordCount: number
        openGraphData?: {
            title?: string
            description?: string
        }
        // New enhanced data fields for better AI context
        bodyTextExcerpt?: string // First 500-1000 words of body text
        urlSegments?: string[] // URL path segments for topic hierarchy
        structuredData?: unknown[] // JSON-LD data for content type/product info
        links?: {
            internal: { href: string; text: string; isNofollow: boolean }[]
            external: { href: string; text: string; isNofollow: boolean }[]
        }
        imageAlts?: string[] // All image alt texts for keyword context
        contentFeatures?: {
            lists: number // Count of ul/ol elements
            tables: number // Count of table elements
            faqs: number // Count of FAQ patterns (dt/dd, accordions)
            blockquotes: number // Count of blockquote elements
            codeBlocks: number // Count of pre/code elements
        }
    }
    pageName?: string
}

export interface AIGenerateResponse {
    type: AIGenerateType
    items: string[]
    rationale?: string
}

const AI_API_URL = import.meta.env.VITE_AI_API_URL ?? "https://first-rank-proxy.vercel.app/api/ai-generate"
const ALT_TEXT_API_URL =
    import.meta.env.VITE_ALT_TEXT_API_URL ?? "https://first-rank-proxy.vercel.app/api/generate-alt-text"

const TIMEOUT = 30000 // 30 seconds
const ALT_TEXT_TIMEOUT = 45000 // 45 seconds (vision models can be slower)

export const AIService = {
    async generate(payload: AIGenerateRequest, signal?: AbortSignal): Promise<AIGenerateResponse> {
        if (!AI_API_URL) {
            throw new Error("AI API URL not configured. Please set VITE_AI_API_URL environment variable.")
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
            controller.abort()
        }, TIMEOUT)

        // Combine external signal with timeout
        if (signal) {
            signal.addEventListener("abort", () => {
                controller.abort()
            })
        }

        try {
            const response = await fetch(AI_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            })

            if (!response.ok) {
                const contentType = response.headers.get("content-type")
                let errorMessage = `AI API error: ${response.status}`

                if (contentType?.includes("application/json")) {
                    try {
                        const errorData = (await response.json()) as { error?: string }
                        errorMessage = errorData.error ?? errorMessage
                    } catch {
                        // Fallback to status text
                    }
                } else {
                    const text = await response.text().catch(() => "")
                    if (text) errorMessage = text
                }

                throw new Error(errorMessage)
            }

            const data = (await response.json()) as Partial<AIGenerateResponse>

            // Validate response structure
            if (!data.type || !Array.isArray(data.items)) {
                throw new Error("Invalid response format from AI API")
            }

            return { type: data.type, items: data.items, rationale: data.rationale }
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === "AbortError") {
                    throw new Error("Request timed out. Please try again.")
                }
                throw error
            }
            throw new Error("Failed to generate AI suggestions")
        } finally {
            clearTimeout(timeoutId)
        }
    },

    /**
     * Generate alt text for an image using AI vision models
     * @param imageUrl - The URL or data URI of the image
     * @param signal - Optional abort signal
     * @returns The generated alt text and the model used
     */
    async generateAltText(imageUrl: string, signal?: AbortSignal): Promise<AltTextGenerateResponse> {
        if (!ALT_TEXT_API_URL) {
            throw new Error("Alt text API URL not configured. Please set VITE_ALT_TEXT_API_URL environment variable.")
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
            controller.abort()
        }, ALT_TEXT_TIMEOUT)

        // Combine external signal with timeout
        if (signal) {
            signal.addEventListener("abort", () => {
                controller.abort()
            })
        }

        try {
            const response = await fetch(ALT_TEXT_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ imageUrl }),
                signal: controller.signal,
            })

            if (!response.ok) {
                const contentType = response.headers.get("content-type")
                let errorMessage = `AI API error: ${response.status}`

                if (contentType?.includes("application/json")) {
                    try {
                        const errorData = (await response.json()) as { error?: string }
                        errorMessage = errorData.error ?? errorMessage
                    } catch {
                        // Fallback to status text
                    }
                } else {
                    const text = await response.text().catch(() => "")
                    if (text) errorMessage = text
                }

                throw new Error(errorMessage)
            }

            const data = (await response.json()) as Partial<AltTextGenerateResponse>

            // Validate response structure
            if (!data.altText || !data.model) {
                throw new Error("Invalid response format from AI API")
            }

            return { altText: data.altText, model: data.model }
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === "AbortError") {
                    throw new Error("Request timed out. Please try again.")
                }
                throw error
            }
            throw new Error("Failed to generate alt text")
        } finally {
            clearTimeout(timeoutId)
        }
    },
}
