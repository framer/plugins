import { normalizeCodeFilePathWithExtension, type SyncPhase } from "@code-link/shared"
import type { Installer } from "./helpers/installer.ts"
import { createPromptSession, PluginUserPromptCoordinator } from "./helpers/plugin-prompts.ts"
import { createScheduler } from "./scheduler.ts"
import { TIMINGS } from "./timings.ts"
import type { Conflict } from "./types.ts"
import type { SyncMemoryHandle } from "./sync-memory.ts"
import { SyncMemory } from "./sync-memory.ts"
import type { FileMetadataCache, FileSyncMetadata } from "./utils/file-metadata-cache.ts"
import type { PersistedFileState } from "./utils/state-persistence.ts"
import type { WebSocket } from "ws"

export interface PendingRenameConfirmation {
    oldFileName: string
    content: string
}

/**
 * Subset of the metadata cache that `describeEffect` may call.
 * Only reads — no `record*`, no `flush`.
 */
export interface ReadonlyFileMetadataCache {
    get(fileName: string): FileSyncMetadata | undefined
    has(fileName: string): boolean
    size(): number
    getPersistedState(): Map<string, PersistedFileState>
}

/**
 * Read-only projection of SyncRuntime handed to `describeEffect`.
 *
 * Invariant: describe must not mutate runtime state. Anything that would mutate
 * must be returned as a `RuntimeOp` and applied by `applyEffectResult`. The
 * narrower type at the describe boundary makes that a compile error, not a
 * convention.
 *
 * `SyncRuntime` satisfies this structurally, so call sites just pass the runtime.
 */
export interface ReadonlyRuntime {
    shouldSkipInboundEcho(path: string, content: string): boolean
    shouldSkipDeleteEcho(path: string): boolean
    isEcho(path: string, content: string): boolean
    isDeleteEcho(path: string): boolean
    getPendingRename(newPath: string): PendingRenameConfirmation | undefined
    readonly metadata: ReadonlyFileMetadataCache
    readonly disconnectUi: {
        didShowNotice(): boolean
        wasRecentlyDisconnected(): boolean
    }
    readonly lastEmittedSyncPhase: SyncPhase | null
    readonly connectionId: number
}

/**
 * Owns mutable sync runtime state: sync memory, prompts, pending renames, installer,
 * disconnect UI flags, and connection identity for prompt sessions.
 */
export class SyncRuntime {
    private readonly sync: SyncMemory = new SyncMemory()
    private readonly pendingRenameConfirmations = new Map<string, PendingRenameConfirmation>()
    private readonly userActions = new PluginUserPromptCoordinator()
    private readonly disconnectScheduler = createScheduler()

    installer: Installer | null = null

    private connectionSeq = 0
    private activeConnectionId = 0

    private isShowingDisconnect = false
    private hadRecentDisconnect = false

    private lastEmittedPhase: SyncPhase | null = null

    noteEmittedSyncPhase(phase: SyncPhase): void {
        this.lastEmittedPhase = phase
    }

    clearEmittedSyncPhase(): void {
        this.lastEmittedPhase = null
    }

    get lastEmittedSyncPhase(): SyncPhase | null {
        return this.lastEmittedPhase
    }

    /** Increment and return a new connection id (call on each successful HANDSHAKE). */
    mintConnectionId(): number {
        this.connectionSeq += 1
        this.activeConnectionId = this.connectionSeq
        return this.activeConnectionId
    }

    get connectionId(): number {
        return this.activeConnectionId
    }

    readonly disconnectUi = {
        scheduleNotice: (callback: () => void): void => {
            this.disconnectScheduler.cancel("disconnectNotice")
            this.hadRecentDisconnect = true
            this.isShowingDisconnect = false
            this.disconnectScheduler.after("disconnectNotice", TIMINGS.disconnectNotice, () => {
                this.isShowingDisconnect = true
                callback()
            })
        },
        cancelNotice: (): void => {
            this.disconnectScheduler.cancel("disconnectNotice")
        },
        didShowNotice: (): boolean => this.isShowingDisconnect,
        wasRecentlyDisconnected: (): boolean => this.hadRecentDisconnect,
        reset: (): void => {
            this.isShowingDisconnect = false
            this.hadRecentDisconnect = false
        },
    }

    memoryHandle(): SyncMemoryHandle {
        return this.sync.memoryHandle()
    }

    // --- SyncMemory + metadata (narrow surface) ---

    isEcho(path: string, content: string): boolean {
        return this.sync.isEcho(path, content)
    }

    isDeleteEcho(path: string): boolean {
        return this.sync.isDeleteEcho(path)
    }

    rememberLocalSend(path: string, content: string): void {
        this.sync.rememberContentHash(path, content)
    }

    forgetPath(path: string): void {
        this.sync.forgetPath(path)
    }

    clearInboundHashes(): void {
        this.sync.clearInboundHashes()
    }

    shouldSkipInboundEcho(path: string, content: string): boolean {
        return this.sync.shouldSkipInboundEcho(path, content)
    }

    shouldSkipDeleteEcho(path: string): boolean {
        return this.sync.shouldSkipDeleteEcho(path)
    }

    clearDeleteTombstone(path: string): void {
        this.sync.clearDeleteTombstone(path)
    }

    markDeleteBeforeUnlink(path: string): void {
        this.sync.markDeleteBeforeUnlink(path)
    }

    get metadata(): FileMetadataCache {
        return this.sync.fileMetadataCache
    }

    // --- Pending renames ---

    getPendingRename(newPath: string): PendingRenameConfirmation | undefined {
        return this.pendingRenameConfirmations.get(normalizeCodeFilePathWithExtension(newPath))
    }

    setPendingRename(newPath: string, value: PendingRenameConfirmation): void {
        this.pendingRenameConfirmations.set(normalizeCodeFilePathWithExtension(newPath), value)
    }

    deletePendingRename(newPath: string): void {
        this.pendingRenameConfirmations.delete(normalizeCodeFilePathWithExtension(newPath))
    }

    clearPendingRenames(): void {
        this.pendingRenameConfirmations.clear()
    }

    // --- User prompts ---

    async requestDeleteDecision(
        socket: WebSocket | null,
        args: { fileNames: string[]; requireConfirmation: boolean }
    ): Promise<string[]> {
        const session = createPromptSession(this.connectionId)
        return this.userActions.requestDeleteDecision(socket, { ...args, session })
    }

    async requestConflictDecisions(
        socket: WebSocket | null,
        conflicts: Conflict[]
    ): Promise<Map<string, "local" | "remote">> {
        const session = createPromptSession(this.connectionId)
        return this.userActions.requestConflictDecisions(socket, conflicts, session)
    }

    resolvePendingAction<T>(actionId: string, value: T): boolean {
        return this.userActions.resolvePendingAction(actionId, value)
    }

    cleanupUserActions(): void {
        this.userActions.cleanup()
    }
}
