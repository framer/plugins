// Thin wrapper around Framer plugin storage with safe fallbacks
// Docs: https://www.framer.com/developers/storing-data

interface FramerGlobal {
    setPluginData: (key: string, value: string | null) => Promise<void>
    getPluginData: (key: string) => Promise<string | null>
    getPluginDataKeys?: () => Promise<string[]>
    getNode?: (nodeId: string) => Promise<{
        setPluginData: (key: string, value: string | null) => Promise<void>
        getPluginData: (key: string) => Promise<string | null>
        getPluginDataKeys?: () => Promise<string[]>
    } | null>
}

function getFramer(): FramerGlobal | null {
    // framer is injected on the global scope inside the plugin iframe
    if (typeof window === "undefined") return null
    const w = window as { framer?: FramerGlobal }
    return w.framer ?? null
}

// Project-level storage
export async function setProjectData(key: string, value: string): Promise<void> {
    const framer = getFramer()
    if (framer) {
        await framer.setPluginData(key, value)
        return
    }
    // Dev/local fallback
    try {
        localStorage.setItem(key, value)
    } catch {
        // Storage unavailable (e.g. sandboxed iframe); persisting is best-effort.
    }
}

export async function getProjectData(key: string): Promise<string | null> {
    const framer = getFramer()
    if (framer) {
        return await framer.getPluginData(key)
    }
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

// Node-level storage (page-level storage with fallback)
export async function setNodeData(nodeId: string, key: string, value: string): Promise<void> {
    const framer = getFramer()
    if (framer?.getNode) {
        try {
            const node = await framer.getNode(nodeId)
            if (node) {
                await node.setPluginData(key, value)
                return
            }
        } catch {
            // Node unavailable; fall through to the local fallback below.
        }
    }
    // Dev/local fallback - use localStorage with node-scoped key
    try {
        const storageKey = `node:${nodeId}:${key}`
        localStorage.setItem(storageKey, value)
    } catch {
        // Storage unavailable (e.g. sandboxed iframe); persisting is best-effort.
    }
}

export async function getNodeData(nodeId: string, key: string): Promise<string | null> {
    const framer = getFramer()
    if (framer?.getNode) {
        try {
            const node = await framer.getNode(nodeId)
            if (node) {
                return await node.getPluginData(key)
            }
        } catch {
            // Node unavailable; fall through to the local fallback below.
        }
    }
    // Dev/local fallback - use localStorage with node-scoped key
    try {
        const storageKey = `node:${nodeId}:${key}`
        return localStorage.getItem(storageKey)
    } catch {
        return null
    }
}

// Delete project-level data by key
export async function deleteProjectData(key: string): Promise<void> {
    const framer = getFramer()
    if (framer) {
        await framer.setPluginData(key, null)
        return
    }
    // Dev/local fallback
    try {
        localStorage.removeItem(key)
    } catch {
        // Storage unavailable; deletion is best-effort.
    }
}

// Get all project-level data keys
export async function getProjectDataKeys(): Promise<string[]> {
    const framer = getFramer()
    if (framer?.getPluginDataKeys) {
        return await framer.getPluginDataKeys()
    }
    // Dev/local fallback
    try {
        return Object.keys(localStorage)
    } catch {
        return []
    }
}

// Cleanup old entries (migration helper)
export async function cleanupOldEntries(): Promise<void> {
    try {
        const keys = await getProjectDataKeys()

        // Clean up old seo-keyword entries
        const oldKeywordKeys = keys.filter(k => k.startsWith("seo-keyword:"))

        for (const key of oldKeywordKeys) {
            await deleteProjectData(key)
        }

        // Clean up old frame-rank entries (node-level storage)
        const oldFrameRankKeys = keys.filter(k => k.startsWith("node:") && k.includes(":frame-rank"))

        for (const key of oldFrameRankKeys) {
            await deleteProjectData(key)
        }
    } catch {
        // Cleanup is best-effort; never block startup on it.
    }
}

// Keep old function name for backward compatibility
export async function cleanupOldKeywordEntries(): Promise<void> {
    return cleanupOldEntries()
}
