import { framer } from "framer-plugin"
import { useMemo, useState } from "react"
import { AI_GENERATION_ENABLED } from "../../config/featureFlags"

// Widen the literal flag type so the toggle reads as a runtime condition rather than dead code
const aiGenerationEnabled: boolean = AI_GENERATION_ENABLED

import { clearAnalysisCache } from "../../lib/analysisCache"
import { AIService } from "../../services/aiService"
import { FramerImageService } from "../../services/framerImageService"
import type { SEOImage } from "../../types/seo"
import "./styles.css"

interface ImageTableProps {
    images: SEOImage[]
}

interface GroupedImage {
    src: string
    alt: string | null
    count: number
    instances: SEOImage[]
    nodeIds: string[]
    imageType: "SVG" | "Image"
    isLocked: boolean
}

export function ImageTable({ images }: ImageTableProps) {
    const [editingStates, setEditingStates] = useState<Record<string, string>>({})
    const [savingStates, setSavingStates] = useState<Record<string, boolean>>({})
    const [savedAlts, setSavedAlts] = useState<Record<string, string>>({})
    const [generatingAlt, setGeneratingAlt] = useState<Record<string, boolean>>({})

    // Helper function to detect if image is SVG
    const isSVG = (src: string): boolean => {
        if (!src) return false

        // Check for .svg extension
        if (src.toLowerCase().includes(".svg")) return true

        // Check for SVG data URI
        if (src.startsWith("data:image/svg+xml")) return true

        return false
    }

    // Group images by their src and apply saved alt texts
    const groupedImages = useMemo((): GroupedImage[] => {
        const groups = new Map<string, GroupedImage>()

        images.forEach(image => {
            const existing = groups.get(image.src)

            if (existing) {
                existing.count++
                existing.instances.push(image)
                if (image.nodeId) {
                    existing.nodeIds.push(image.nodeId)
                }
            } else {
                // Use saved alt text if available, otherwise use the image's alt
                const altText = savedAlts[image.src] ?? image.alt

                groups.set(image.src, {
                    src: image.src,
                    alt: altText,
                    count: 1,
                    instances: [image],
                    nodeIds: image.nodeId ? [image.nodeId] : [],
                    imageType: isSVG(image.src) ? "SVG" : "Image",
                    isLocked: image.isLocked ?? false,
                })
            }
        })

        // Filter out images with no valid src and sort
        return Array.from(groups.values())
            .filter(group => group.src && group.src.trim() !== "") // Only show images with valid src
            .sort((a, b) => {
                // First sort by type: 'Image' comes before 'SVG'
                if (a.imageType !== b.imageType) {
                    return a.imageType === "Image" ? -1 : 1
                }
                // Then sort by count (descending - most copies first)
                return b.count - a.count
            })
    }, [images, savedAlts])

    const handleAltChange = (src: string, value: string) => {
        setEditingStates(prev => ({
            ...prev,
            [src]: value,
        }))
    }

    const handleSave = async (src: string, group: GroupedImage) => {
        if (group.nodeIds.length === 0) {
            return
        }

        const newAltText = (editingStates[src] ?? savedAlts[src] ?? group.alt ?? "").trim()
        const baseline = (savedAlts[src] ?? group.alt ?? "").trim()

        // Don't save if nothing changed (after trimming whitespace)
        if (newAltText === baseline) {
            return
        }

        setSavingStates(prev => ({ ...prev, [src]: true }))

        try {
            // Update all instances of this image
            await Promise.all(
                group.nodeIds.map(nodeId => FramerImageService.updateImageAltText(nodeId, newAltText, false))
            )

            // Reflect saved value immediately in UI (store trimmed version)
            setSavedAlts(prev => ({ ...prev, [src]: newAltText.trim() }))

            // Clear editing state after successful save
            setEditingStates(prev => {
                const { [src]: _removed, ...rest } = prev
                return rest
            })

            // Show notification
            const instanceText = group.count > 1 ? `${group.count} copies` : "1 image"
            framer.notify(`Alt text updated for ${instanceText}`, { variant: "success" })

            // Clear analysis cache to force fresh data on next page load
            // No need to trigger immediate re-analysis - UI updates via state
            clearAnalysisCache()
        } catch (error) {
            console.error("Failed to update alt text:", error)
            // Show more specific error message based on error type
            if (error instanceof Error) {
                if (error.message.includes("insufficient permissions") || error.message.includes("setAttributes")) {
                    framer.notify("Cannot edit: Insufficient permissions", { variant: "error" })
                } else if (error.message.includes("No image property found")) {
                    framer.notify("Cannot edit: Image format not supported", { variant: "error" })
                } else {
                    framer.notify(`Failed to update alt text: ${error.message}`, { variant: "error" })
                }
            } else {
                framer.notify("Failed to update alt text", { variant: "error" })
            }
        } finally {
            setSavingStates(prev => ({ ...prev, [src]: false }))
        }
    }

    const getCurrentAltText = (src: string, group: GroupedImage) => {
        if (editingStates[src] !== undefined) return editingStates[src]
        if (savedAlts[src] !== undefined) return savedAlts[src]
        return group.alt ?? ""
    }

    const handleGenerateAltText = async (src: string, group: GroupedImage) => {
        if (group.nodeIds.length === 0) {
            framer.notify("Cannot generate: No node ID for image", { variant: "error" })
            return
        }

        // Don't generate for SVGs
        if (group.imageType === "SVG") {
            framer.notify("AI generation not available for SVG images", { variant: "error" })
            return
        }

        setGeneratingAlt(prev => ({ ...prev, [src]: true }))

        try {
            console.log("Generating alt text for image:", src.substring(0, 50))

            // Call AI service to generate alt text
            const response = await AIService.generateAltText(src)
            const generatedAltText = response.altText

            console.log(`Generated alt text using ${response.model}:`, generatedAltText)

            // Update the editing state with generated text
            setEditingStates(prev => ({
                ...prev,
                [src]: generatedAltText,
            }))

            // Automatically save the generated alt text
            setSavingStates(prev => ({ ...prev, [src]: true }))

            try {
                // Update all instances of this image
                await Promise.all(
                    group.nodeIds.map(nodeId => FramerImageService.updateImageAltText(nodeId, generatedAltText, false))
                )

                // Reflect saved value immediately in UI
                setSavedAlts(prev => ({ ...prev, [src]: generatedAltText.trim() }))

                // Clear editing state after successful save
                setEditingStates(prev => {
                    const { [src]: _removed, ...rest } = prev
                    return rest
                })

                // Show success notification
                const instanceText = group.count > 1 ? `${group.count} copies` : "1 image"
                framer.notify(`✨ AI-generated alt text saved for ${instanceText}`, { variant: "success" })

                // Clear analysis cache
                clearAnalysisCache()
            } catch (saveError) {
                console.error("Failed to save generated alt text:", saveError)

                if (saveError instanceof Error) {
                    if (
                        saveError.message.includes("insufficient permissions") ||
                        saveError.message.includes("setAttributes")
                    ) {
                        framer.notify("Cannot save: Insufficient permissions", { variant: "error" })
                    } else if (saveError.message.includes("No image property found")) {
                        framer.notify("Cannot save: Image format not supported", { variant: "error" })
                    } else {
                        framer.notify("Failed to save alt text", { variant: "error" })
                    }
                } else {
                    framer.notify("Failed to save alt text", { variant: "error" })
                }
            } finally {
                setSavingStates(prev => ({ ...prev, [src]: false }))
            }
        } catch (error) {
            console.error("Failed to generate alt text:", error)

            let errorMessage = "Failed to generate alt text"
            if (error instanceof Error) {
                if (error.message.includes("AI service not configured") || error.message.includes("API key")) {
                    errorMessage = "AI service not configured"
                } else if (error.message.includes("timed out")) {
                    errorMessage = "Request timed out. Please try again."
                } else if (error.message.includes("unavailable")) {
                    errorMessage = "AI generation unavailable"
                } else {
                    errorMessage = error.message
                }
            }

            framer.notify(errorMessage, { variant: "error" })
        } finally {
            setGeneratingAlt(prev => ({ ...prev, [src]: false }))
        }
    }

    if (images.length === 0) {
        return (
            <div className="image-table-empty">
                <p>No images found on this page</p>
            </div>
        )
    }

    return (
        <div className="image-table-container">
            <table className="image-table">
                <thead>
                    <tr>
                        <th className="image-col">Image</th>
                        <th className="alt-text-col">Alt Text</th>
                    </tr>
                </thead>
                <tbody>
                    {groupedImages.map((group, index) => {
                        const currentAltText = getCurrentAltText(group.src, group)
                        const isSaving = savingStates[group.src] ?? false
                        const isGenerating = generatingAlt[group.src] ?? false
                        const isSVG = group.imageType === "SVG"

                        return (
                            <tr key={index} className="image-table-row">
                                <td className="image-cell">
                                    <div className="image-thumb-wrap">
                                        {group.src ? (
                                            <>
                                                <img
                                                    src={group.src}
                                                    alt={currentAltText || "Preview"}
                                                    className="image-thumbnail"
                                                    onError={e => {
                                                        e.currentTarget.style.display = "none"
                                                        e.currentTarget.nextElementSibling?.classList.remove("hidden")
                                                    }}
                                                />
                                                <div className="image-placeholder hidden">
                                                    <div>No preview</div>
                                                    {group.nodeIds[0] !== undefined && (
                                                        <div className="node-id-label">
                                                            ID: {group.nodeIds[0].substring(0, 8)}...
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="image-placeholder">
                                                <div>No preview</div>
                                                {group.nodeIds[0] !== undefined && (
                                                    <div className="node-id-label">
                                                        ID: {group.nodeIds[0].substring(0, 8)}...
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="alt-text-cell">
                                    <div className="alt-text-container">
                                        <textarea
                                            value={currentAltText}
                                            onChange={e => {
                                                handleAltChange(group.src, e.target.value)
                                            }}
                                            placeholder="No Alt Text"
                                            className="alt-text-input"
                                            rows={2}
                                            disabled={
                                                isSaving || isGenerating || group.nodeIds.length === 0 || group.isLocked
                                            }
                                        />
                                        <div className="ai-suggestion-char-button-group">
                                            <button
                                                className="ai-suggestion-action-button primary save"
                                                onClick={() => void handleSave(group.src, group)}
                                                disabled={isSaving || isGenerating}
                                                title="Save alt text"
                                            >
                                                {isSaving ? "⏳ Saving..." : "💾 Save"}
                                            </button>

                                            {aiGenerationEnabled && !isSVG && (
                                                <button
                                                    className="ai-suggestion-action-button primary save"
                                                    onClick={() => void handleGenerateAltText(group.src, group)}
                                                    disabled={
                                                        isGenerating ||
                                                        isSaving ||
                                                        group.nodeIds.length === 0 ||
                                                        group.isLocked
                                                    }
                                                    title="Generate alt text using AI"
                                                >
                                                    {isGenerating ? "⏳ Generating..." : "✨ Write Alt Text"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
