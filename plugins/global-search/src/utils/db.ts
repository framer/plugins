import { type DBSchema, type IDBPDatabase, openDB } from "idb"
import type { ResumableAsyncIterable } from "./filter/AsyncProcessor"
import type { IndexEntry } from "./indexer/types"

interface IndexMetadata {
    fullyIndexedOn: number
}

interface MetadataEntry {
    key: "index"
    value: IndexMetadata
}

interface GlobalSearchDB extends DBSchema {
    entries: {
        key: string
        value: IndexEntry
        indexes: {
            id: string
            type: string
            rootNodeType: string
            addedInIndexRun: number
            rootNodeIdVersion: [string, number]
        }
    }
    metadata: {
        key: string
        value: MetadataEntry
    }
}

export class GlobalSearchDatabase implements ResumableAsyncIterable<IndexEntry> {
    private db: IDBPDatabase<GlobalSearchDB> | null = null
    private readonly dbName: string

    constructor(projectId: string, projectName: string) {
        this.dbName = `global-search-${projectName}-${projectId}`
    }

    async open(): Promise<IDBPDatabase<GlobalSearchDB>> {
        if (this.db) return this.db

        this.db = await openDB<GlobalSearchDB>(this.dbName, 3, {
            upgrade(db, oldVersion, _newVersion, transaction) {
                if (oldVersion < 1) {
                    const entriesStore = db.createObjectStore("entries", { keyPath: "id" })
                    entriesStore.createIndex("rootNodeType", "rootNodeType")
                    entriesStore.createIndex("type", "type")
                    entriesStore.createIndex("addedInIndexRun", "addedInIndexRun")
                }

                if (oldVersion < 2) {
                    const entriesStore = transaction.objectStore("entries")
                    // Add compound index for [rootNodeId, addedInIndexRun] - this is all we need
                    entriesStore.createIndex("rootNodeIdVersion", ["rootNodeId", "addedInIndexRun"])
                }

                if (oldVersion < 3) {
                    db.createObjectStore("metadata", { keyPath: "key" })
                }
            },
        })

        return this.db
    }

    async upsertEntries(entries: IndexEntry[]): Promise<void> {
        const db = await this.open()
        const tx = db.transaction("entries", "readwrite")
        await Promise.all(entries.map(entry => tx.store.put(entry)))
        await tx.done
    }

    async *iterateFrom(startKey: string | null): AsyncGenerator<IndexEntry> {
        const db = await this.open()
        const tx = db.transaction("entries", "readonly")
        const store = tx.objectStore("entries")

        // Use exclusive lower bound (true) to avoid re-processing the startKey item when resuming
        const keyRange = startKey ? IDBKeyRange.lowerBound(startKey, true) : undefined
        let cursor = await store.openCursor(keyRange)

        try {
            while (cursor) {
                yield cursor.value

                cursor = await cursor.continue()
            }
        } finally {
            // Ensure transaction completes even if iteration is interrupted
            await tx.done
        }
    }

    async getLastIndexRun(): Promise<number> {
        const db = await this.open()
        const tx = db.transaction("entries", "readonly")
        const index = tx.objectStore("entries").index("addedInIndexRun")
        const cursor = await index.openCursor(null, "prev")

        return cursor?.value.addedInIndexRun ?? -1
    }

    async getTotalEntries(): Promise<number> {
        const db = await this.open()
        return await db.count("entries")
    }

    /**
     * Removes all entries added before the given version.
     *
     * This is used to clear the database when the indexer is done to avoid
     * keeping old entries around.
     */
    async clearEntriesFromBefore(version: number): Promise<void> {
        const db = await this.open()
        const tx = db.transaction("entries", "readwrite")
        const store = tx.objectStore("entries")
        const index = store.index("addedInIndexRun")

        // Delete all entries with addedInIndexRun < version
        let cursor = await index.openCursor(IDBKeyRange.upperBound(version, true))
        while (cursor) {
            await cursor.delete()
            cursor = await cursor.continue()
        }

        await tx.done
    }

    /**
     * Removes entries for a specific root node from a specific index run version.
     *
     * This is used for incremental updates when a specific canvas root changes.
     */
    async clearEntriesForRootNodeAndSpecificVersion(rootNodeId: string, version: number): Promise<void> {
        const db = await this.open()
        const tx = db.transaction("entries", "readwrite")
        const store = tx.objectStore("entries")
        const index = store.index("rootNodeIdVersion")

        // Use compound index to efficiently find entries with exact [rootNodeId, version] match
        let cursor = await index.openCursor(IDBKeyRange.only([rootNodeId, version]))
        while (cursor) {
            await cursor.delete()
            cursor = await cursor.continue()
        }

        await tx.done
    }

    async setInitialIndexCompleted(timestamp: number): Promise<void> {
        const db = await this.open()
        const tx = db.transaction("metadata", "readwrite")
        await tx.store.put({
            key: "index",
            value: {
                fullyIndexedOn: timestamp,
            },
        })
        await tx.done
    }

    async getIndexMetadata(): Promise<IndexMetadata | null> {
        const db = await this.open()
        const tx = db.transaction("metadata", "readonly")
        const result = await tx.store.get("index")
        return result?.value ?? null
    }

    async hasCompletedInitialIndex(): Promise<boolean> {
        const metadata = await this.getIndexMetadata()
        const fullyIndexedOn = metadata?.fullyIndexedOn
        if (fullyIndexedOn === undefined) return false

        // Consider the index valid if it was completed within the last month
        const currentTime = Date.now()
        const oneMonthAgo = currentTime - ONE_MONTH_IN_MS
        return fullyIndexedOn >= oneMonthAgo
    }
}

const ONE_MONTH_IN_MS = 1000 * 60 * 60 * 24 * 30
