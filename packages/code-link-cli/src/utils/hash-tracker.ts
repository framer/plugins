/**
 * Hash tracking utilities for echo prevention
 *
 * The hash tracker prevents echo loops by remembering content hashes
 * and skipping watcher events for files we just wrote.
 */

import { hashFileContent } from "./state-persistence.ts"

export interface HashTracker {
    remember(filePath: string, content: string): void
    shouldSkip(filePath: string, content: string): boolean
    forget(filePath: string): void
    clear(): void
    markDelete(filePath: string): void
    shouldSkipDelete(filePath: string): boolean
    clearDelete(filePath: string): void
}

/**
 * Creates a hash tracker instance for echo prevention
 */
export function createHashTracker(): HashTracker {
    const hashes = new Map<string, string>()
    const pendingDeletes = new Map<string, ReturnType<typeof setTimeout>>()

    return {
        remember(filePath: string, content: string): void {
            const hash = hashFileContent(content)
            hashes.set(filePath, hash)
        },

        shouldSkip(filePath: string, content: string): boolean {
            const currentHash = hashFileContent(content)
            const storedHash = hashes.get(filePath)
            return storedHash === currentHash
        },

        forget(filePath: string): void {
            hashes.delete(filePath)
        },

        clear(): void {
            hashes.clear()
        },

        markDelete(filePath: string): void {
            const existingTimer = pendingDeletes.get(filePath)
            if (existingTimer) {
                clearTimeout(existingTimer)
            }

            const timeout = setTimeout(() => {
                pendingDeletes.delete(filePath)
            }, 5000)

            pendingDeletes.set(filePath, timeout)
        },

        shouldSkipDelete(filePath: string): boolean {
            return pendingDeletes.has(filePath)
        },

        clearDelete(filePath: string): void {
            const timeout = pendingDeletes.get(filePath)
            if (timeout) {
                clearTimeout(timeout)
            }
            pendingDeletes.delete(filePath)
        },
    }
}
