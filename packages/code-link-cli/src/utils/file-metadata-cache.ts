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
            this.metadata.set(fileName, {
                localHash: state.contentHash,
                lastSyncedHash: state.contentHash,
                lastRemoteTimestamp: state.timestamp,
            })
        }

        this.initialized = true
    }

    get(fileName: string): FileSyncMetadata | undefined {
        return this.metadata.get(fileName)
    }

    has(fileName: string): boolean {
        return this.metadata.has(fileName)
    }

    size(): number {
        return this.metadata.size
    }

    getPersistedState(): Map<string, PersistedFileState> {
        return this.persisted
    }

    recordRemoteWrite(fileName: string, content: string, remoteModifiedAt: number): void {
        const contentHash = hashFileContent(content)
        this.metadata.set(fileName, {
            localHash: contentHash,
            lastSyncedHash: contentHash,
            lastRemoteTimestamp: remoteModifiedAt,
        })
        this.persisted.set(fileName, {
            contentHash,
            timestamp: remoteModifiedAt,
        })
        this.schedulePersist()
    }

    recordSyncedSnapshot(fileName: string, contentHash: string, remoteModifiedAt: number): void {
        this.metadata.set(fileName, {
            localHash: contentHash,
            lastSyncedHash: contentHash,
            lastRemoteTimestamp: remoteModifiedAt,
        })
        this.persisted.set(fileName, {
            contentHash,
            timestamp: remoteModifiedAt,
        })
        this.schedulePersist()
    }

    recordDelete(fileName: string): void {
        this.metadata.delete(fileName)
        this.persisted.delete(fileName)
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
