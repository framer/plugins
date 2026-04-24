/**
 * SyncMemory owns file-level sync truth.
 *
 * If a race depends on path normalization, content echoes, delete tombstones,
 * or agreed metadata, it belongs here. Controller/apply code should call these
 * named operations instead of touching the underlying maps directly.
 */

import { normalizeCodeFilePathWithExtension } from "@code-link/shared"
import { createScheduler } from "./scheduler.ts"
import { TIMINGS } from "./timings.ts"
import { FileMetadataCache, type FileSyncMetadata } from "./utils/file-metadata-cache.ts"
import { hashFileContent, type PersistedFileState } from "./utils/state-persistence.ts"

export interface PreparedContentEcho {
    path: string
    content: string
}

export interface PreparedDeleteTombstone {
    path: string
}

export interface FileOperationMemory {
    armContentEcho(filePath: string, content: string): PreparedContentEcho
    matchesContentEcho(filePath: string, content: string): boolean
    rollbackWriteFailure(prepared: PreparedContentEcho): void
    armDeleteTombstone(filePath: string): PreparedDeleteTombstone
    rollbackDeleteFailure(prepared: PreparedDeleteTombstone): void
}

export class SyncMemory {
    readonly metadata = new FileMetadataCache()

    private readonly contentEchoes = new Map<string, string>()
    private readonly deleteTombstones = new Set<string>()
    private readonly scheduler = createScheduler()

    normalizePath(filePath: string): string {
        return normalizeCodeFilePathWithExtension(filePath)
    }

    // --- agreed metadata -----------------------------------------------------

    metadataFor(filePath: string): FileSyncMetadata | undefined {
        return this.metadata.get(filePath)
    }

    persistedSnapshot(): Map<string, PersistedFileState> {
        return this.metadata.getPersistedState()
    }

    recordSyncedContent(filePath: string, content: string, modifiedAt: number): void {
        this.metadata.recordSyncedSnapshot(filePath, hashFileContent(content), modifiedAt)
    }

    recordSyncedDelete(filePath: string): void {
        this.clearContentEcho(filePath)
        this.metadata.recordDelete(filePath)
    }

    matchesAgreedContent(filePath: string, content: string): boolean {
        return this.metadataFor(filePath)?.lastSyncedHash === hashFileContent(content)
    }

    // --- content echoes ------------------------------------------------------

    armContentEcho(filePath: string, content: string): PreparedContentEcho {
        const path = this.normalizePath(filePath)
        this.contentEchoes.set(path, hashFileContent(content))
        return { path, content }
    }

    matchesContentEcho(filePath: string, content: string): boolean {
        return this.contentEchoes.get(this.normalizePath(filePath)) === hashFileContent(content)
    }

    clearContentEcho(filePath: string): void {
        this.contentEchoes.delete(this.normalizePath(filePath))
    }

    clearAllContentEchoes(): void {
        this.contentEchoes.clear()
    }

    isContentEcho(filePath: string, content: string): boolean {
        return this.matchesAgreedContent(filePath, content) || this.matchesContentEcho(filePath, content)
    }

    commitWriteSuccess(prepared: PreparedContentEcho, modifiedAt: number): void {
        this.recordSyncedContent(prepared.path, prepared.content, modifiedAt)
    }

    rollbackWriteFailure(prepared: PreparedContentEcho): void {
        if (this.matchesContentEcho(prepared.path, prepared.content)) {
            this.clearContentEcho(prepared.path)
        }
    }

    // --- delete tombstones ---------------------------------------------------

    armDeleteTombstone(filePath: string): PreparedDeleteTombstone {
        const path = this.normalizePath(filePath)
        this.scheduler.cancel("tombstoneExpiry", path)
        this.deleteTombstones.add(path)
        this.scheduler.after(
            "tombstoneExpiry",
            TIMINGS.tombstoneExpiry,
            () => {
                this.deleteTombstones.delete(path)
            },
            path
        )
        return { path }
    }

    matchesDeleteTombstone(filePath: string): boolean {
        return this.deleteTombstones.has(this.normalizePath(filePath))
    }

    clearDeleteTombstone(filePath: string): void {
        const path = this.normalizePath(filePath)
        this.scheduler.cancel("tombstoneExpiry", path)
        this.deleteTombstones.delete(path)
    }

    commitDeleteSuccess(prepared: PreparedDeleteTombstone): void {
        this.clearContentEcho(prepared.path)
        this.recordSyncedDelete(prepared.path)
    }

    rollbackDeleteFailure(prepared: PreparedDeleteTombstone): void {
        this.clearDeleteTombstone(prepared.path)
    }
}
