import { framer, isComponentInstanceNode, isImageAsset } from "framer-plugin"
import type { SEOImage } from "../types/seo"

export const FramerImageService = {
    /**
     * Get all images from the Framer project for Alt Image analysis.
     * Note: This returns project-wide images, not page-specific images.
     * @param _pageId - Currently unused, kept for API compatibility
     */
    async getPageImages(_pageId: string): Promise<SEOImage[]> {
        try {
            // Get all nodes with backgroundImage attribute (project-wide)
            const imageNodes = await framer.getNodesWithAttributeSet("backgroundImage")

            return imageNodes.map(node => ({
                src: node.backgroundImage?.url ?? "",
                alt: node.backgroundImage?.altText ?? null,
                width: undefined,
                height: undefined,
                loading: undefined,
                nodeId: node.id, // Include node ID for updating
                // Lock state isn't reliably exposed by the API; treat all as editable.
                isLocked: false,
            }))
        } catch {
            // Return empty array on error - will use HTML fallback
            return []
        }
    },

    /**
     * Updates alt text for an image node using Framer's immutable image pattern.
     * Since ImageAsset objects are immutable, we must clone with new attributes.
     *
     * @param nodeId - The Framer node ID
     * @param altText - The new alt text to set
     * @param showNotification - Whether to show a success notification (default: false)
     */
    async updateImageAltText(nodeId: string, altText: string, showNotification = false): Promise<void> {
        const trimmed = altText.trim()

        // Check permissions using Framer's official API
        if (!framer.isAllowedTo("setAttributes")) {
            throw new Error("insufficient permissions to set attributes")
        }

        // Resolve the node via the same query that discovered it: getNode() does
        // not resolve every node getNodesWithAttributeSet() returns (e.g. nodes
        // on other web pages), which surfaced as "Node not found" on save.
        const imageNodes = await framer.getNodesWithAttributeSet("backgroundImage")
        const imageNode = imageNodes.find(candidate => candidate.id === nodeId)
        if (imageNode?.backgroundImage) {
            await imageNode.setAttributes({
                backgroundImage: imageNode.backgroundImage.cloneWithAttributes({ altText: trimmed }),
            })

            if (showNotification) {
                framer.notify("Alt text updated successfully", { variant: "success" })
            }
            return
        }

        // Component instances may expose the image via an "image" control.
        const node = await framer.getNode(nodeId)
        if (node && isComponentInstanceNode(node)) {
            const image = node.controls.image
            if (isImageAsset(image)) {
                await node.setAttributes({
                    controls: { ...node.controls, image: image.cloneWithAttributes({ altText: trimmed }) },
                })

                if (showNotification) {
                    framer.notify("Alt text updated successfully", { variant: "success" })
                }
                return
            }
        }

        // If no image property found, throw an error
        throw new Error("No image property found")
    },
}
