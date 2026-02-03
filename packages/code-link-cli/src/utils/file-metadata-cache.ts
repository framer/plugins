import { fileKeyForLookup } from "@code-link/shared"
import {
    hashFileContent,
    loadPersistedState,
    type PersistedFileState,
    savePersistedState,
} from "./state-persistence.ts"

/**
 * In-memory cache on top of state-persistence.
 */

export interface FileSyncMetadata {
    localHash: string
    lastSyncedHash: string
    lastRemoteTimestamp?: number
}

export class FileMetadataCache {
    private metadata = new Map<string, FileSyncMetadata>()
    private persisted = new Map<string, PersistedFileState>()
    private projectDir: string | null = null
    private initialized = false
    private pendingPersist: Promise<void> | null = null

    async initialize(projectDir: string): Promise<void> {
        if (this.initialized && this.projectDir === projectDir) {
            return
        }

        this.projectDir = projectDir
        const loaded = await loadPersistedState(projectDir)
        this.persisted = loaded
        this.metadata = new Map()

        for (const [fileName, state] of loaded.entries()) {
            this.metadata.set(fileKeyForLookup(fileName), {
                localHash: state.contentHash,
                lastSyncedHash: state.contentHash,
                lastRemoteTimestamp: state.timestamp,
            })
        }

        this.initialized = true
    }

    get(fileName: string): FileSyncMetadata | undefined {
        return this.metadata.get(fileKeyForLookup(fileName))
    }

    has(fileName: string): boolean {
        return this.metadata.has(fileKeyForLookup(fileName))
    }

    size(): number {
        return this.metadata.size
    }

    getPersistedState(): Map<string, PersistedFileState> {
        return this.persisted
    }

    recordRemoteWrite(fileName: string, content: string, remoteModifiedAt: number): void {
        const key = fileKeyForLookup(fileName)
        const contentHash = hashFileContent(content)
        this.metadata.set(key, {
            localHash: contentHash,
            lastSyncedHash: contentHash,
            lastRemoteTimestamp: remoteModifiedAt,
        })
        this.persisted.set(key, {
            contentHash,
            timestamp: remoteModifiedAt,
        })
        this.schedulePersist()
    }

    recordSyncedSnapshot(fileName: string, contentHash: string, remoteModifiedAt: number): void {
        const key = fileKeyForLookup(fileName)
        this.metadata.set(key, {
            localHash: contentHash,
            lastSyncedHash: contentHash,
            lastRemoteTimestamp: remoteModifiedAt,
        })
        this.persisted.set(key, {
            contentHash,
            timestamp: remoteModifiedAt,
        })
        this.schedulePersist()
    }

    recordDelete(fileName: string): void {
        const key = fileKeyForLookup(fileName)
        this.metadata.delete(key)
        this.persisted.delete(key)
        this.schedulePersist()
    }

    async flush(): Promise<void> {
        if (this.pendingPersist) {
            await this.pendingPersist
        }
    }

    private schedulePersist(): void {
        const projectDir = this.projectDir
        if (!projectDir) {
            return
        }

        this.pendingPersist ??= (async () => {
            try {
                await Promise.resolve()
                await savePersistedState(projectDir, this.persisted)
            } finally {
                this.pendingPersist = null
            }
        })()
    }
}
