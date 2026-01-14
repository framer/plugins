import { hashContent } from "./hash.js"
import { canonicalFileName } from "./paths.js"

export interface SyncTracker {
    remember(fileName: string, content: string): void
    shouldSkip(fileName: string, content: string): boolean
    forget(fileName: string): void
    clear(): void
}

/**
 * Creates a sync tracker for echo prevention
 * Remembers content hashes to avoid syncing back what we just received
 */
export function createSyncTracker(): SyncTracker {
    const contentHashes = new Map<string, string>()

    return {
        remember(fileName: string, content: string) {
            contentHashes.set(canonicalFileName(fileName), hashContent(content))
        },

        shouldSkip(fileName: string, content: string) {
            return contentHashes.get(canonicalFileName(fileName)) === hashContent(content)
        },

        forget(fileName: string) {
            contentHashes.delete(canonicalFileName(fileName))
        },

        clear() {
            contentHashes.clear()
        },
    }
}
