/**
 * Single data model for peer agreement, inbound echo suppression, and delete tombstones.
 * Owns persisted metadata; in-memory echo/delete windows match legacy hash-tracker semantics.
 */

import { normalizeCodeFilePathWithExtension } from "@code-link/shared"
import { createScheduler } from "./scheduler.ts"
import { TIMINGS } from "./timings.ts"
import { FileMetadataCache } from "./utils/file-metadata-cache.ts"
import { hashFileContent } from "./utils/state-persistence.ts"

/**
 * Narrow surface for disk helpers (`writeRemoteFiles`, `deleteLocalFile`, `filterEchoedFiles`).
 * Implemented by `SyncBase` via `peerBaseView()`.
 */
export interface PeerBaseView {
    rememberRemoteWrite(filePath: string, content: string): void
    shouldSkipInboundEcho(filePath: string, content: string): boolean
    markDeleteBeforeUnlink(filePath: string): void
    forgetPath(filePath: string): void
    clearDeleteTombstone(filePath: string): void
    shouldSkipDeleteEcho(filePath: string): boolean
}

export class SyncBase {
    readonly fileMetadataCache = new FileMetadataCache()

    private readonly hashes = new Map<string, string>()
    private readonly tombstoneKeys = new Set<string>()
    private readonly scheduler = createScheduler()

    private keyFor(filePath: string): string {
        return normalizeCodeFilePathWithExtension(filePath)
    }

    /** Remember expected content hash (local outbound echo or pre-remote-write). */
    rememberContentHash(filePath: string, content: string): void {
        const hash = hashFileContent(content)
        this.hashes.set(this.keyFor(filePath), hash)
    }

    shouldSkipInboundEcho(filePath: string, content: string): boolean {
        const currentHash = hashFileContent(content)
        const storedHash = this.hashes.get(this.keyFor(filePath))
        return storedHash === currentHash
    }

    forgetPath(filePath: string): void {
        this.hashes.delete(this.keyFor(filePath))
    }

    clearInboundHashes(): void {
        this.hashes.clear()
    }

    markDeleteBeforeUnlink(filePath: string): void {
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

    shouldSkipDeleteEcho(filePath: string): boolean {
        return this.tombstoneKeys.has(this.keyFor(filePath))
    }

    clearDeleteTombstone(filePath: string): void {
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
        return this.shouldSkipInboundEcho(path, content)
    }

    isDeleteEcho(path: string): boolean {
        return this.shouldSkipDeleteEcho(path)
    }

    peerBaseView(): PeerBaseView {
        return {
            rememberRemoteWrite: (filePath, content) => this.rememberContentHash(filePath, content),
            shouldSkipInboundEcho: (filePath, content) => this.shouldSkipInboundEcho(filePath, content),
            markDeleteBeforeUnlink: (filePath: string) => this.markDeleteBeforeUnlink(filePath),
            forgetPath: (filePath: string) => this.forgetPath(filePath),
            clearDeleteTombstone: (filePath: string) => this.clearDeleteTombstone(filePath),
            shouldSkipDeleteEcho: (filePath: string) => this.shouldSkipDeleteEcho(filePath),
        }
    }
}
