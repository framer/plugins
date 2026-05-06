/**
 * SyncMemory owns file-level sync truth.
 *
 * If a race depends on path normalization, content echoes, expected delete echoes,
 * or agreed metadata, it belongs here. Controller/apply code should call these
 * named operations instead of touching the underlying maps directly.
 */

import { normalizeCodeFilePathWithExtension } from "@code-link/shared"
import { createScheduler, TIMINGS } from "./scheduler.ts"
import { FileMetadataCache, type FileSyncMetadata } from "./utils/file-metadata-cache.ts"
import { hashFileContent, type PersistedFileState } from "./utils/state-persistence.ts"

export interface PreparedContentEcho {
    path: string
    content: string
}

export interface PreparedExpectedDeleteEcho {
    path: string
}

export interface FileOperationMemory {
    armContentEcho(filePath: string, content: string): PreparedContentEcho
    matchesContentEcho(filePath: string, content: string): boolean
    rollbackWriteFailure(prepared: PreparedContentEcho): void
    armExpectedDeleteEcho(filePath: string): PreparedExpectedDeleteEcho
    rollbackExpectedDeleteEcho(prepared: PreparedExpectedDeleteEcho): void
}

export class SyncMemory {
    readonly metadata = new FileMetadataCache()

    private readonly contentEchoes = new Map<string, string>()
    private readonly expectedDeleteEchoes = new Set<string>()
    private readonly scheduler = createScheduler()

    normalizePath(filePath: string): string {
        return normalizeCodeFilePathWithExtension(filePath)
    }

    // Agreed Metadata

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

    // Content Echoes

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

    // Identical content to the last synced hash is a no-op echo, not a fresh local change.
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

    // Expected Delete Echoes

    armExpectedDeleteEcho(filePath: string): PreparedExpectedDeleteEcho {
        const path = this.normalizePath(filePath)
        this.scheduler.cancel("expectedDeleteEchoExpiry", path)
        this.expectedDeleteEchoes.add(path)
        this.scheduler.after(
            "expectedDeleteEchoExpiry",
            TIMINGS.expectedDeleteEchoExpiry,
            () => {
                this.expectedDeleteEchoes.delete(path)
            },
            path
        )
        return { path }
    }

    matchesExpectedDeleteEcho(filePath: string): boolean {
        return this.expectedDeleteEchoes.has(this.normalizePath(filePath))
    }

    clearExpectedDeleteEcho(filePath: string): void {
        const path = this.normalizePath(filePath)
        this.scheduler.cancel("expectedDeleteEchoExpiry", path)
        this.expectedDeleteEchoes.delete(path)
    }

    commitDeleteSuccess(prepared: PreparedExpectedDeleteEcho): void {
        this.clearContentEcho(prepared.path)
        this.recordSyncedDelete(prepared.path)
    }

    rollbackExpectedDeleteEcho(prepared: PreparedExpectedDeleteEcho): void {
        this.clearExpectedDeleteEcho(prepared.path)
    }
}
