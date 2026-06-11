import { framer } from "framer-plugin"
import type { Page, PublishInfo } from "../types/page"

function constructPageUrl(pagePath: string, base?: string): string | undefined {
    if (!base) return undefined

    return pagePath === "/" || pagePath === "home"
        ? base
        : `${base}${pagePath.startsWith("/") ? pagePath : "/" + pagePath}`
}

export const FramerService = {
    async getPublishInfo(): Promise<PublishInfo> {
        return framer.getPublishInfo()
    },

    // Subscribe to live publish-info changes. Framer invokes the callback
    // immediately with the current value, then again on every (re)publish —
    // so the displayed domain self-corrects the moment a custom domain goes live.
    // Returns an unsubscribe function.
    subscribeToPublishInfo(callback: (info: PublishInfo) => void): () => void {
        return framer.subscribeToPublishInfo(callback)
    },

    // Build the page list against `baseUrl` (the selected domain). When omitted,
    // falls back to production, then staging — so behavior is unchanged for
    // callers that don't pick an environment.
    async getPages(baseUrl?: string): Promise<Page[]> {
        const pubInfo = await FramerService.getPublishInfo()
        const base = baseUrl ?? pubInfo.production?.url ?? pubInfo.staging?.url
        const webPageNodes = await framer.getNodesWithType("WebPageNode")

        const projectPages: Page[] = webPageNodes.map(node => {
            const pagePath = node.path ?? `page-${node.id}`
            const pageName = pagePath.replace(/^\//, "").replace(/-/g, " ") || "Home"
            const displayName = pageName.charAt(0).toUpperCase() + pageName.slice(1)
            return {
                id: node.id,
                name: displayName,
                category: "Static",
                url: constructPageUrl(pagePath, base),
            }
        })

        if (projectPages.length === 0 && base) {
            projectPages.push({
                id: "home",
                name: "Home",
                category: "Static",
                url: base,
            })
        }

        return projectPages
    },
}
