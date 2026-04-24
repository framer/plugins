import { randomUUID } from "node:crypto"
import { normalizeCodeFilePathWithExtension, type PromptSession, type SyncPhase } from "@code-link/shared"
import path from "path"
import type { Installer } from "./helpers/installer.ts"
import { createScheduler, TIMINGS } from "./scheduler.ts"
import { SyncMemory } from "./sync-memory.ts"
import type { Conflict } from "./types.ts"
import type { FileMetadataCache } from "./utils/file-metadata-cache.ts"

export interface PendingRenameConfirmation {
    oldFileName: string
    content: string
}

export interface RuntimeWorkspace {
    readonly projectDir: string | null
    readonly filesDir: string | null
    readonly projectDirCreated: boolean
}

interface DeletePromptState {
    session: PromptSession
    fileNames: Set<string>
}

interface DeferredSyncComplete {
    totalCount: number
    updatedCount: number
    unchangedCount: number
}

interface ConflictPromptState {
    session: PromptSession
    conflicts: Map<string, Conflict>
}

function sameSession(a: PromptSession, b: PromptSession): boolean {
    return a.connectionId === b.connectionId && a.promptId === b.promptId
}

function createPromptSession(connectionId: number): PromptSession {
    return { connectionId, promptId: randomUUID() }
}

export interface ResolvedPromptConflict {
    fileName: string
    content: string | null
    modifiedAt?: number
}

export type ConflictPromptChange =
    | { changed: false }
    | {
          changed: true
          session: PromptSession
          conflicts: Conflict[]
          cleared: boolean
          resolved: ResolvedPromptConflict[]
      }

export type DeletePromptChange =
    | { changed: false }
    | { changed: true; session: PromptSession; fileNames: string[]; cleared: boolean }

function conflictIsResolved(conflict: Conflict): boolean {
    return conflict.localContent === conflict.remoteContent
}

function resolvedPromptConflict(conflict: Conflict): ResolvedPromptConflict {
    return {
        fileName: conflict.fileName,
        content: conflict.localContent,
        modifiedAt: conflict.remoteModifiedAt ?? conflict.localModifiedAt,
    }
}

function normalizeConflict(filePath: (path: string) => string, conflict: Conflict): Conflict {
    return {
        ...conflict,
        fileName: filePath(conflict.fileName),
    }
}

/**
 * SyncRuntime owns lifecycle truth.
 *
 * Search this file and `sync-memory.ts` first for race-sensitive state.
 * Lifecycle state lives here; file-level sync facts live on `memory`.
 */
export class SyncRuntime {
    readonly memory = new SyncMemory()
    private readonly pendingRenameConfirmations = new Map<string, PendingRenameConfirmation>()
    private readonly disconnectScheduler = createScheduler()

    private activeDeletePrompt: DeletePromptState | null = null
    private activeConflictPrompt: ConflictPromptState | null = null
    private deferredSyncComplete: DeferredSyncComplete | null = null

    installer: Installer | null = null

    private connectionSeq = 0
    private activeConnectionId = 0
    private isShowingDisconnect = false
    private hadRecentDisconnect = false
    private lastEmittedPhase: SyncPhase | null = null

    private readonly workspaceState: {
        projectDir: string | null
        filesDir: string | null
        projectDirCreated: boolean
    } = {
        projectDir: null,
        filesDir: null,
        projectDirCreated: false,
    }

    get workspace(): RuntimeWorkspace {
        return this.workspaceState
    }

    get metadata(): FileMetadataCache {
        return this.memory.metadata
    }

    configureWorkspace(projectDir: string, projectDirCreated: boolean): void {
        this.workspaceState.projectDir = projectDir
        this.workspaceState.filesDir = path.join(projectDir, "files")
        this.workspaceState.projectDirCreated = projectDirCreated
    }

    // Connection / Phase

    mintConnectionId(): number {
        this.connectionSeq += 1
        this.activeConnectionId = this.connectionSeq
        return this.activeConnectionId
    }

    get connectionId(): number {
        return this.activeConnectionId
    }

    noteEmittedSyncPhase(phase: SyncPhase): void {
        this.lastEmittedPhase = phase
    }

    clearEmittedSyncPhase(): void {
        this.lastEmittedPhase = null
    }

    get lastEmittedSyncPhase(): SyncPhase | null {
        return this.lastEmittedPhase
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

    // Pending Renames

    getPendingRename(newPath: string): PendingRenameConfirmation | undefined {
        return this.pendingRenameConfirmations.get(normalizeCodeFilePathWithExtension(newPath))
    }

    registerPendingRename(newPath: string, value: PendingRenameConfirmation): void {
        this.pendingRenameConfirmations.set(normalizeCodeFilePathWithExtension(newPath), value)
    }

    completePendingRename(newPath: string): void {
        this.pendingRenameConfirmations.delete(normalizeCodeFilePathWithExtension(newPath))
    }

    clearPendingRenames(): void {
        this.pendingRenameConfirmations.clear()
    }

    // Prompt State

    startDeletePrompt(fileNames: string[]): { session: PromptSession; fileNames: string[] } | null {
        const prompt = this.activeDeletePrompt ?? {
            session: createPromptSession(this.connectionId),
            fileNames: new Set<string>(),
        }
        const newNames: string[] = []
        for (const fileName of fileNames) {
            const normalized = this.memory.normalizePath(fileName)
            if (prompt.fileNames.has(normalized)) continue
            prompt.fileNames.add(normalized)
            newNames.push(normalized)
        }
        this.activeDeletePrompt = prompt
        return newNames.length > 0 ? { session: prompt.session, fileNames: newNames } : null
    }

    hasActiveDeletePrompt(session: PromptSession): boolean {
        return this.activeDeletePrompt !== null && sameSession(this.activeDeletePrompt.session, session)
    }

    getDeletePromptFileNames(session: PromptSession, fileNames: string[]): string[] | null {
        const prompt = this.activeDeletePrompt
        if (!prompt || !sameSession(prompt.session, session)) return null
        const requested =
            fileNames.length > 0
                ? fileNames.map(fileName => this.memory.normalizePath(fileName))
                : [...prompt.fileNames.values()]
        const active = requested.filter(fileName => prompt.fileNames.has(fileName))
        return active.length > 0 ? active : null
    }

    clearDeletePromptFiles(session: PromptSession, fileNames: string[]): boolean {
        const prompt = this.activeDeletePrompt
        if (!prompt || !sameSession(prompt.session, session)) return false
        const requested = fileNames.length > 0 ? fileNames : [...prompt.fileNames.values()]
        for (const fileName of requested) {
            prompt.fileNames.delete(this.memory.normalizePath(fileName))
        }
        if (prompt.fileNames.size === 0) this.activeDeletePrompt = null
        return true
    }

    isActiveDeletePromptPath(filePath: string): boolean {
        return this.activeDeletePrompt?.fileNames.has(this.memory.normalizePath(filePath)) ?? false
    }

    hasAnyActiveDeletePrompt(): boolean {
        return this.activeDeletePrompt !== null
    }

    deferSyncComplete(syncComplete: DeferredSyncComplete): void {
        this.deferredSyncComplete =
            this.deferredSyncComplete === null
                ? syncComplete
                : {
                      totalCount: this.deferredSyncComplete.totalCount + syncComplete.totalCount,
                      updatedCount: this.deferredSyncComplete.updatedCount + syncComplete.updatedCount,
                      unchangedCount: this.deferredSyncComplete.unchangedCount + syncComplete.unchangedCount,
                  }
    }

    consumeDeferredSyncCompleteIfNoDeletePrompt(): DeferredSyncComplete | null {
        if (this.activeDeletePrompt !== null) return null
        const syncComplete = this.deferredSyncComplete
        this.deferredSyncComplete = null
        return syncComplete
    }

    invalidateDeletePromptPath(filePath: string): DeletePromptChange {
        const prompt = this.activeDeletePrompt
        const normalized = this.memory.normalizePath(filePath)
        if (!prompt || !prompt.fileNames.has(normalized)) return { changed: false }
        prompt.fileNames.delete(normalized)
        const cleared = prompt.fileNames.size === 0
        if (cleared) this.activeDeletePrompt = null
        return {
            changed: true,
            session: prompt.session,
            fileNames: [normalized],
            cleared,
        }
    }

    startOrUpdateConflictPrompt(conflicts: Conflict[]): { session: PromptSession; conflicts: Conflict[] } | null {
        if (conflicts.length === 0) return null
        const prompt = this.activeConflictPrompt ?? {
            session: createPromptSession(this.connectionId),
            conflicts: new Map<string, Conflict>(),
        }

        for (const conflict of conflicts) {
            const normalized = normalizeConflict(filePath => this.memory.normalizePath(filePath), conflict)
            if (conflictIsResolved(normalized)) {
                prompt.conflicts.delete(normalized.fileName)
            } else {
                prompt.conflicts.set(normalized.fileName, normalized)
            }
        }

        const nextConflicts = [...prompt.conflicts.values()]
        this.activeConflictPrompt = nextConflicts.length > 0 ? prompt : null
        return nextConflicts.length > 0 ? { session: prompt.session, conflicts: nextConflicts } : null
    }

    getActiveConflictPrompt(): { session: PromptSession; conflicts: Conflict[] } | null {
        const prompt = this.activeConflictPrompt
        return prompt ? { session: prompt.session, conflicts: [...prompt.conflicts.values()] } : null
    }

    getConflictPromptConflicts(session: PromptSession, fileNames: string[]): Conflict[] | null {
        const prompt = this.activeConflictPrompt
        if (!prompt || !sameSession(prompt.session, session)) return null
        const requested =
            fileNames.length > 0
                ? fileNames.map(fileName => this.memory.normalizePath(fileName))
                : [...prompt.conflicts.keys()]
        const conflicts = requested
            .map(fileName => prompt.conflicts.get(fileName))
            .filter((conflict): conflict is Conflict => conflict !== undefined)
        return conflicts.length > 0 ? conflicts : null
    }

    clearConflictPromptFiles(session: PromptSession, fileNames: string[]): boolean {
        const prompt = this.activeConflictPrompt
        if (!prompt || !sameSession(prompt.session, session)) return false
        const requested = fileNames.length > 0 ? fileNames : [...prompt.conflicts.keys()]
        for (const fileName of requested) {
            prompt.conflicts.delete(this.memory.normalizePath(fileName))
        }
        if (prompt.conflicts.size === 0) this.activeConflictPrompt = null
        return true
    }

    isActiveConflictPath(filePath: string): boolean {
        return this.activeConflictPrompt?.conflicts.has(this.memory.normalizePath(filePath)) ?? false
    }

    updateActiveConflictLocal(filePath: string, content: string | null, modifiedAt?: number): ConflictPromptChange {
        const prompt = this.activeConflictPrompt
        const key = this.memory.normalizePath(filePath)
        const conflict = prompt?.conflicts.get(key)
        if (!prompt || !conflict) return { changed: false }
        const next = {
            ...conflict,
            fileName: key,
            localContent: content,
            localModifiedAt: modifiedAt,
        }
        const resolved = conflictIsResolved(next) ? [resolvedPromptConflict(next)] : []
        if (resolved.length > 0) {
            prompt.conflicts.delete(key)
        } else {
            prompt.conflicts.set(key, next)
        }
        const conflicts = [...prompt.conflicts.values()]
        const cleared = conflicts.length === 0
        if (cleared) this.activeConflictPrompt = null
        return { changed: true, session: prompt.session, conflicts, cleared, resolved }
    }

    updateActiveConflictRemote(filePath: string, content: string | null, modifiedAt?: number): ConflictPromptChange {
        const prompt = this.activeConflictPrompt
        const key = this.memory.normalizePath(filePath)
        const conflict = prompt?.conflicts.get(key)
        if (!prompt || !conflict) return { changed: false }
        const next = {
            ...conflict,
            fileName: key,
            remoteContent: content,
            remoteModifiedAt: modifiedAt,
        }
        const resolved = conflictIsResolved(next) ? [resolvedPromptConflict(next)] : []
        if (resolved.length > 0) {
            prompt.conflicts.delete(key)
        } else {
            prompt.conflicts.set(key, next)
        }
        const conflicts = [...prompt.conflicts.values()]
        const cleared = conflicts.length === 0
        if (cleared) this.activeConflictPrompt = null
        return { changed: true, session: prompt.session, conflicts, cleared, resolved }
    }

    resetPrompts(): void {
        this.activeDeletePrompt = null
        this.activeConflictPrompt = null
        this.deferredSyncComplete = null
    }

    cleanupUserActions(): void {
        this.resetPrompts()
    }
}
