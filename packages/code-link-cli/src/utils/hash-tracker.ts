/**
 * Hash tracking utilities for echo prevention
 *
 * The hash tracker prevents echo loops by remembering content hashes
 * and skipping watcher events for files we just wrote.
 */

import { normalizeCodeFileName } from "@code-link/shared"
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

    const keyFor = (filePath: string) => normalizeCodeFileName(filePath)

    return {
        remember(filePath: string, content: string): void {
            const hash = hashFileContent(content)
            hashes.set(keyFor(filePath), hash)
        },

        shouldSkip(filePath: string, content: string): boolean {
            const currentHash = hashFileContent(content)
            const storedHash = hashes.get(keyFor(filePath))
            return storedHash === currentHash
        },

        forget(filePath: string): void {
            hashes.delete(keyFor(filePath))
        },

        clear(): void {
            hashes.clear()
        },

        markDelete(filePath: string): void {
            const key = keyFor(filePath)
            const existingTimer = pendingDeletes.get(key)
            if (existingTimer) {
                clearTimeout(existingTimer)
            }

            const timeout = setTimeout(() => {
                pendingDeletes.delete(key)
            }, 5000)

            pendingDeletes.set(key, timeout)
        },

        shouldSkipDelete(filePath: string): boolean {
            return pendingDeletes.has(keyFor(filePath))
        },

        clearDelete(filePath: string): void {
            const key = keyFor(filePath)
            const timeout = pendingDeletes.get(key)
            if (timeout) {
                clearTimeout(timeout)
            }
            pendingDeletes.delete(key)
        },
    }
}
