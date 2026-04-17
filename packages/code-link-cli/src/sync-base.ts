/**
 * Single data model for peer agreement, inbound echo suppression, and delete tombstones.
 * Owns persisted metadata; in-memory echo/delete windows match legacy hash-tracker semantics.
 */

import { normalizeCodeFilePathWithExtension } from "@code-link/shared"
import { createScheduler } from "./scheduler.ts"
import { TIMINGS } from "./timings.ts"
import { FileMetadataCache } from "./utils/file-metadata-cache.ts"
import { hashFileContent } from "./utils/state-persistence.ts"

/** Echo + delete tombstone surface used by disk helpers (legacy hash-tracker API). */
export interface HashTracker {
    remember(filePath: string, content: string): void
    shouldSkip(filePath: string, content: string): boolean
    forget(filePath: string): void
    clear(): void
    markDelete(filePath: string): void
    shouldSkipDelete(filePath: string): boolean
    clearDelete(filePath: string): void
}

export class SyncBase implements HashTracker {
    readonly fileMetadataCache = new FileMetadataCache()

    private readonly hashes = new Map<string, string>()
    private readonly tombstoneKeys = new Set<string>()
    private readonly scheduler = createScheduler()

    private keyFor(filePath: string): string {
        return normalizeCodeFilePathWithExtension(filePath)
    }

    remember(filePath: string, content: string): void {
        const hash = hashFileContent(content)
        this.hashes.set(this.keyFor(filePath), hash)
    }

    shouldSkip(filePath: string, content: string): boolean {
        const currentHash = hashFileContent(content)
        const storedHash = this.hashes.get(this.keyFor(filePath))
        return storedHash === currentHash
    }

    forget(filePath: string): void {
        this.hashes.delete(this.keyFor(filePath))
    }

    clear(): void {
        this.hashes.clear()
    }

    markDelete(filePath: string): void {
        const key = this.keyFor(filePath)
        this.scheduler.cancel("tombstoneExpiry", key)
        this.tombstoneKeys.add(key)
        this.scheduler.after(
            "tombstoneExpiry",
            TIMINGS.tombstoneExpiry,
            () => {
                this.tombstoneKeys.delete(key)
            },
            key
        )
    }

    shouldSkipDelete(filePath: string): boolean {
        return this.tombstoneKeys.has(this.keyFor(filePath))
    }

    clearDelete(filePath: string): void {
        const key = this.keyFor(filePath)
        this.scheduler.cancel("tombstoneExpiry", key)
        this.tombstoneKeys.delete(key)
    }

    /**
     * Echo/conflict “base” snapshot: persisted agreement state (legacy fileMetadataCache shape).
     */
    snapshot() {
        return this.fileMetadataCache.getPersistedState()
    }

    isEcho(path: string, content: string): boolean {
        const h = hashFileContent(content)
        const meta = this.fileMetadataCache.get(path)
        if (meta?.lastSyncedHash === h) {
            return true
        }
        return this.shouldSkip(path, content)
    }

    isDeleteEcho(path: string): boolean {
        return this.shouldSkipDelete(path)
    }
}

/** Backward-compatible factory (tests + helpers expect `createHashTracker`). */
export function createHashTracker(): SyncBase {
    return new SyncBase()
}
