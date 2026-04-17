/**
 * CLI Controller
 *
 * All runtime state and orchestration of the sync lifecycle.
 * Helpers should provide data and never hold control.
 *
 * ## How a sync event flows
 *
 * 1. **Ingress** — WebSocket messages, fs watcher, and handshake enqueue one `SyncEvent` at a time via
 *    `EventQueue` so `processEvent` never interleaves across await boundaries.
 * 2. **transition** — Pure function: `(state, event) → { state, effects }`. No I/O.
 * 3. **executeEffect** — For each effect: may await helpers (list files, detect conflicts); builds or
 *    delegates to `EffectResult`; **`applyEffectResult`** runs the fixed pipeline below.
 * 4. **applyEffectResult** (fixed order):
 *    - `log`
 *    - **pre-send kernel ops** — `recordLocalSend`, `registerPendingRename`, `recordDelete`
 *    - **writes** — remember-on-peer then disk (`writeRemoteFiles`)
 *    - **deletes** — tombstone/forget then disk (`deleteLocalFile`)
 *    - **sends** — WebSocket; then `fileUp` / installer hooks for successful `file-change`
 *    - **post-send kernel ops** — `recordRemoteApplied`, `completePendingRename`, `schedule`, `cancel`
 *    - **persistState** — flush metadata cache
 *    - Echo and delete-tombstone state live in `SyncKernel` / `SyncBase`, not scattered in helpers.
 */

import type { CliToPluginMessage, PluginToCliMessage, SyncPhase } from "@code-link/shared"
import { normalizeCodeFilePathWithExtension, pluralize, shortProjectHash } from "@code-link/shared"
import fs from "fs/promises"
import path from "path"
import type { WebSocket } from "ws"
import { CERT_DIR, getOrCreateCerts } from "./helpers/certs.ts"
import { initConnection, sendMessage } from "./helpers/connection.ts"
import {
    autoResolveConflicts,
    deleteLocalFile,
    detectConflicts,
    filterEchoedFiles,
    listFiles,
    readFileSafe,
    writeRemoteFiles,
} from "./helpers/files.ts"
import { tryGitInit } from "./helpers/git.ts"
import { conflictPromptActionId, deletePromptActionId } from "./helpers/plugin-prompts.ts"
import { Installer } from "./helpers/installer.ts"
import { SyncKernel, type PendingRenameConfirmation } from "./kernel.ts"
import { validateIncomingChange } from "./helpers/sync-validator.ts"
import { initWatcher } from "./helpers/watcher.ts"
import type { Config, Conflict, ConflictVersionData, FileInfo, InternalPhase, WatcherEvent } from "./types.ts"
import type { FileSyncMetadata } from "./utils/file-metadata-cache.ts"
import {
    debug,
    error,
    fileDelete,
    fileDown,
    fileUp,
    info,
    status,
    success,
    warn,
} from "./utils/logging.ts"
import type { EffectResult, KernelOp } from "./effect-result.ts"
import { createEventQueue } from "./event-queue.ts"
import { findOrCreateProjectDirectory } from "./utils/project.ts"
import { hashFileContent } from "./utils/state-persistence.ts"

/**
 * Shared state that persists across all lifecycle modes
 */
interface SyncStateBase {
    pendingRemoteChanges: FileInfo[]
}

type DisconnectedState = SyncStateBase & {
    internalPhase: "disconnected"
    socket: null
}

type HandshakingState = SyncStateBase & {
    internalPhase: "handshaking"
    socket: WebSocket
}

type SnapshotProcessingState = SyncStateBase & {
    internalPhase: "snapshot_processing"
    socket: WebSocket
}

type ConflictResolutionState = SyncStateBase & {
    internalPhase: "conflict_resolution"
    socket: WebSocket
    pendingConflicts: Conflict[]
}

type WatchingState = SyncStateBase & {
    internalPhase: "watching"
    socket: WebSocket
}

export type SyncState =
    | DisconnectedState
    | HandshakingState
    | SnapshotProcessingState
    | ConflictResolutionState
    | WatchingState

/**
 * Events that drive state transitions
 */
type SyncEvent =
    | {
          type: "HANDSHAKE"
          socket: WebSocket
          projectInfo: { projectId: string; projectName: string }
      }
    | { type: "REQUEST_FILES" }
    | { type: "REMOTE_FILE_LIST"; files: FileInfo[] }
    | {
          type: "CONFLICTS_DETECTED"
          conflicts: Conflict[]
          safeWrites: FileInfo[]
          localOnly: FileInfo[]
      }
    | { type: "REMOTE_FILE_CHANGE"; file: FileInfo; fileMeta?: FileSyncMetadata }
    | { type: "REMOTE_FILE_DELETE"; fileName: string }
    | { type: "LOCAL_DELETE_APPROVED"; fileName: string }
    | { type: "LOCAL_DELETE_REJECTED"; fileName: string; content: string }
    | {
          type: "CONFLICTS_RESOLVED"
          resolution: "local" | "remote"
      }
    | {
          type: "FILE_SYNCED_CONFIRMATION"
          fileName: string
          remoteModifiedAt: number
      }
    | { type: "DISCONNECT" }
    | { type: "WATCHER_EVENT"; event: WatcherEvent }
    | {
          type: "CONFLICT_VERSION_RESPONSE"
          versions: ConflictVersionData[]
      }

/**
 * Side effects emitted by transitions
 */
type Effect =
    | {
          type: "INIT_WORKSPACE"
          projectInfo: { projectId: string; projectName: string }
      }
    | { type: "LOAD_PERSISTED_STATE" }
    | { type: "SEND_MESSAGE"; payload: CliToPluginMessage }
    | { type: "EMIT_SYNC_PHASE"; phase: SyncPhase }
    | { type: "LIST_LOCAL_FILES" }
    | { type: "DETECT_CONFLICTS"; remoteFiles: FileInfo[] }
    | {
          type: "WRITE_FILES"
          files: FileInfo[]
          silent?: boolean
          skipEcho?: boolean
      }
    | { type: "DELETE_LOCAL_FILES"; names: string[] }
    | { type: "REQUEST_CONFLICT_DECISIONS"; conflicts: Conflict[] }
    | { type: "REQUEST_CONFLICT_VERSIONS"; conflicts: Conflict[] }
    | {
          type: "UPDATE_FILE_METADATA"
          fileName: string
          remoteModifiedAt: number
      }
    | {
          type: "SEND_LOCAL_CHANGE"
          fileName: string
          content: string
      }
    | {
          type: "LOCAL_INITIATED_FILE_DELETE"
          fileNames: string[]
      }
    | {
          type: "SEND_FILE_RENAME"
          oldFileName: string
          newFileName: string
          content: string
      }
    | { type: "PERSIST_STATE" }
    | {
          type: "SYNC_COMPLETE"
          totalCount: number
          updatedCount: number
          unchangedCount: number
      }
    | {
          type: "LOG"
          level: "info" | "debug" | "warn" | "success"
          message: string
      }

/** Log helper */
function log(level: "info" | "debug" | "warn" | "success", message: string): Effect {
    return { type: "LOG", level, message }
}

export interface TransitionRead {
    wasRecentlyDisconnected?: () => boolean
}

function isPreSendKernelOp(op: KernelOp): boolean {
    return op.op === "recordLocalSend" || op.op === "registerPendingRename" || op.op === "recordDelete"
}

/**
 * Pure state transition function
 * Takes current state + event, returns new state + effects to execute
 */
function transition(state: SyncState, event: SyncEvent, read: TransitionRead = {}): { state: SyncState; effects: Effect[] } {
    const effects: Effect[] = []

    switch (event.type) {
        case "HANDSHAKE": {
            if (state.internalPhase !== "disconnected") {
                effects.push(log("warn", `Received HANDSHAKE in internalPhase=${state.internalPhase}, ignoring`))
                return { state, effects }
            }

            effects.push(
                { type: "INIT_WORKSPACE", projectInfo: event.projectInfo },
                { type: "LOAD_PERSISTED_STATE" },
                { type: "SEND_MESSAGE", payload: { type: "request-files" } },
                { type: "EMIT_SYNC_PHASE", phase: "initial_sync" }
            )

            return {
                state: {
                    ...state,
                    internalPhase: "handshaking",
                    socket: event.socket,
                },
                effects,
            }
        }

        case "FILE_SYNCED_CONFIRMATION": {
            // Remote confirms they received our local change
            effects.push(log("debug", `Remote confirmed sync: ${event.fileName}`), {
                type: "UPDATE_FILE_METADATA",
                fileName: event.fileName,
                remoteModifiedAt: event.remoteModifiedAt,
            })

            return { state, effects }
        }

        case "DISCONNECT": {
            effects.push({ type: "PERSIST_STATE" }, log("debug", "Disconnected, persisting state"))

            if (state.internalPhase === "conflict_resolution") {
                const { pendingConflicts: _discarded, ...rest } = state
                return {
                    state: {
                        ...rest,
                        internalPhase: "disconnected",
                        socket: null,
                    },
                    effects,
                }
            }

            return {
                state: {
                    ...state,
                    internalPhase: "disconnected",
                    socket: null,
                },
                effects,
            }
        }

        case "REQUEST_FILES": {
            // Plugin is asking for our local file list
            // Valid in any mode except disconnected
            if (state.internalPhase === "disconnected") {
                effects.push(log("warn", "Received REQUEST_FILES while disconnected, ignoring"))
                return { state, effects }
            }

            effects.push(log("debug", "Plugin requested file list"), {
                type: "LIST_LOCAL_FILES",
            })

            return { state, effects }
        }

        case "REMOTE_FILE_LIST": {
            if (state.internalPhase !== "handshaking") {
                effects.push(log("warn", `Received REMOTE_FILE_LIST in internalPhase=${state.internalPhase}, ignoring`))
                return { state, effects }
            }

            effects.push(log("debug", `Received file list: ${pluralize(event.files.length, "file")}`))

            // During initial file list, detect conflicts between remote snapshot and local files
            effects.push({
                type: "DETECT_CONFLICTS",
                remoteFiles: event.files,
            })

            // Transition to snapshot_processing - conflict detection effect will determine next mode
            return {
                state: {
                    ...state,
                    internalPhase: "snapshot_processing",
                    pendingRemoteChanges: event.files,
                },
                effects,
            }
        }

        case "CONFLICTS_DETECTED": {
            if (state.internalPhase !== "snapshot_processing") {
                effects.push(log("warn", `Received CONFLICTS_DETECTED in internalPhase=${state.internalPhase}, ignoring`))
                return { state, effects }
            }

            const { conflicts, safeWrites, localOnly } = event

            // detectConflicts returns:
            // - safeWrites = files we can apply (remote-only or local unchanged)
            // - conflicts = files that need manual resolution (content or deletion conflicts)
            // - localOnly = files to upload
            // (unchanged files have metadata recorded in DETECT_CONFLICTS executor)

            // Apply safe writes
            if (safeWrites.length > 0) {
                effects.push(log("debug", `Applying ${safeWrites.length} safe writes`))
                if (read.wasRecentlyDisconnected?.()) {
                    effects.push(log("success", `Applied ${pluralize(safeWrites.length, "file")} during sync`))
                }
                effects.push({
                    type: "WRITE_FILES",
                    files: safeWrites,
                    silent: true,
                })
            }

            // Upload local-only files
            if (localOnly.length > 0) {
                effects.push(log("debug", `Uploading ${pluralize(localOnly.length, "local-only file")}`))
                for (const file of localOnly) {
                    effects.push({
                        type: "SEND_MESSAGE",
                        payload: {
                            type: "file-change",
                            fileName: file.name,
                            content: file.content,
                        },
                    })
                }
            }

            // If conflicts remain, request remote version data before surfacing to user
            if (conflicts.length > 0) {
                effects.push(log("debug", `${pluralize(conflicts.length, "conflict")} require version check`), {
                    type: "REQUEST_CONFLICT_VERSIONS",
                    conflicts,
                })

                return {
                    state: {
                        ...state,
                        internalPhase: "conflict_resolution",
                        pendingConflicts: conflicts,
                    },
                    effects,
                }
            }

            // No conflicts - transition to watching
            const remoteTotal = state.pendingRemoteChanges.length
            const totalCount = remoteTotal + localOnly.length
            const updatedCount = safeWrites.length + localOnly.length
            const unchangedCount = Math.max(0, remoteTotal - safeWrites.length)
            effects.push(
                { type: "PERSIST_STATE" },
                {
                    type: "SYNC_COMPLETE",
                    totalCount,
                    updatedCount,
                    unchangedCount,
                }
            )

            return {
                state: {
                    ...state,
                    internalPhase: "watching",
                    pendingRemoteChanges: [],
                },
                effects,
            }
        }

        case "REMOTE_FILE_CHANGE": {
            // Use helper to validate the incoming change
            const validation = validateIncomingChange(event.fileMeta, state.internalPhase)

            if (validation.action === "queue") {
                // Changes during initial sync are ignored - the snapshot handles reconciliation
                effects.push(log("debug", `Ignoring file change during sync: ${event.file.name}`))
                return { state, effects }
            }

            if (validation.action === "reject") {
                effects.push(log("warn", `Rejected file change: ${event.file.name} (${validation.reason})`))
                return { state, effects }
            }

            // Apply the change
            effects.push(log("debug", `Applying remote change: ${event.file.name}`), {
                type: "WRITE_FILES",
                files: [event.file],
                skipEcho: true,
            })

            return { state, effects }
        }

        case "REMOTE_FILE_DELETE": {
            // Reject if not connected
            if (state.internalPhase === "disconnected") {
                effects.push(log("warn", `Rejected delete while disconnected: ${event.fileName}`))
                return { state, effects }
            }

            // Remote deletes should always be applied immediately
            // (the file is already gone from Framer)
            effects.push(
                log("debug", `Remote delete applied: ${event.fileName}`),
                { type: "DELETE_LOCAL_FILES", names: [event.fileName] },
                { type: "PERSIST_STATE" }
            )

            return { state, effects }
        }

        case "LOCAL_DELETE_APPROVED": {
            // User confirmed the delete - apply it
            effects.push(
                log("debug", `Delete confirmed: ${event.fileName}`),
                { type: "DELETE_LOCAL_FILES", names: [event.fileName] },
                { type: "PERSIST_STATE" }
            )

            return { state, effects }
        }

        case "LOCAL_DELETE_REJECTED": {
            // User cancelled - restore the file
            effects.push(log("debug", `Delete cancelled: ${event.fileName}`))
            effects.push({
                type: "WRITE_FILES",
                files: [
                    {
                        name: event.fileName,
                        content: event.content,
                        modifiedAt: Date.now(),
                    },
                ],
            })

            return { state, effects }
        }

        case "CONFLICTS_RESOLVED": {
            // Only valid in conflict_resolution mode
            if (state.internalPhase !== "conflict_resolution") {
                effects.push(log("warn", `Received CONFLICTS_RESOLVED in internalPhase=${state.internalPhase}, ignoring`))
                return { state, effects }
            }

            // User picked one resolution for ALL conflicts
            if (event.resolution === "remote") {
                // Apply all remote versions (or delete locally if remote is null)
                for (const conflict of state.pendingConflicts) {
                    if (conflict.remoteContent === null) {
                        // Remote deleted this file - delete locally
                        effects.push({
                            type: "DELETE_LOCAL_FILES",
                            names: [conflict.fileName],
                        })
                    } else {
                        effects.push({
                            type: "WRITE_FILES",
                            files: [
                                {
                                    name: conflict.fileName,
                                    content: conflict.remoteContent,
                                    modifiedAt: conflict.remoteModifiedAt,
                                },
                            ],
                            silent: true,
                        })
                    }
                }
                effects.push(log("success", "Keeping Framer changes"))
            } else {
                // Send all local versions (or request delete confirmation if local is null)
                const localDeletes: string[] = []
                for (const conflict of state.pendingConflicts) {
                    if (conflict.localContent === null) {
                        localDeletes.push(conflict.fileName)
                    } else {
                        effects.push({
                            type: "SEND_MESSAGE",
                            payload: {
                                type: "file-change",
                                fileName: conflict.fileName,
                                content: conflict.localContent,
                            },
                        })
                    }
                }
                // Batch local deletes into single confirmation prompt
                if (localDeletes.length > 0) {
                    effects.push({
                        type: "LOCAL_INITIATED_FILE_DELETE",
                        fileNames: localDeletes,
                    })
                }
                effects.push(log("success", "Keeping local changes"))
            }

            // All conflicts resolved - transition to watching
            effects.push(
                { type: "PERSIST_STATE" },
                {
                    type: "SYNC_COMPLETE",
                    totalCount: state.pendingConflicts.length,
                    updatedCount: state.pendingConflicts.length,
                    unchangedCount: 0,
                }
            )

            const { pendingConflicts: _discarded, ...rest } = state
            return {
                state: {
                    ...rest,
                    internalPhase: "watching",
                },
                effects,
            }
        }

        case "WATCHER_EVENT": {
            // Local file system change detected
            const { kind, relativePath, content } = event.event

            // Only process changes in watching mode
            if (state.internalPhase !== "watching") {
                effects.push(log("debug", `Ignoring watcher event in internalPhase=${state.internalPhase}: ${kind} ${relativePath}`))
                return { state, effects }
            }

            switch (kind) {
                case "add":
                case "change": {
                    if (content === undefined) {
                        effects.push(log("warn", `Watcher event missing content: ${relativePath}`))
                        return { state, effects }
                    }

                    effects.push({
                        type: "SEND_LOCAL_CHANGE",
                        fileName: relativePath,
                        content,
                    })
                    break
                }

                case "delete": {
                    effects.push(log("debug", `Local delete detected: ${relativePath}`), {
                        type: "LOCAL_INITIATED_FILE_DELETE",
                        fileNames: [relativePath],
                    })
                    break
                }

                case "rename": {
                    if (content === undefined || !event.event.oldRelativePath) {
                        effects.push(log("warn", `Rename event missing data: ${relativePath}`))
                        return { state, effects }
                    }
                    effects.push(
                        log("debug", `Local rename detected: ${event.event.oldRelativePath} → ${relativePath}`),
                        {
                            type: "SEND_FILE_RENAME",
                            oldFileName: event.event.oldRelativePath,
                            newFileName: relativePath,
                            content,
                        }
                    )
                    break
                }
            }

            return { state, effects }
        }

        case "CONFLICT_VERSION_RESPONSE": {
            if (state.internalPhase !== "conflict_resolution") {
                effects.push(log("warn", `Received CONFLICT_VERSION_RESPONSE in internalPhase=${state.internalPhase}, ignoring`))
                return { state, effects }
            }

            const { autoResolvedLocal, autoResolvedRemote, remainingConflicts } = autoResolveConflicts(
                state.pendingConflicts,
                event.versions
            )

            if (autoResolvedLocal.length > 0) {
                effects.push(log("debug", `Auto-resolved ${autoResolvedLocal.length} local changes`))
                const localDeletes: string[] = []
                for (const conflict of autoResolvedLocal) {
                    if (conflict.localContent === null) {
                        localDeletes.push(conflict.fileName)
                    } else {
                        effects.push({
                            type: "SEND_LOCAL_CHANGE",
                            fileName: conflict.fileName,
                            content: conflict.localContent,
                        })
                    }
                }
                // Batch local deletes into single confirmation prompt
                if (localDeletes.length > 0) {
                    effects.push({
                        type: "LOCAL_INITIATED_FILE_DELETE",
                        fileNames: localDeletes,
                    })
                }
            }

            if (autoResolvedRemote.length > 0) {
                effects.push(log("debug", `Auto-resolved ${autoResolvedRemote.length} remote changes`))
                for (const conflict of autoResolvedRemote) {
                    if (conflict.remoteContent === null) {
                        // Remote deleted - delete locally
                        effects.push({
                            type: "DELETE_LOCAL_FILES",
                            names: [conflict.fileName],
                        })
                    } else {
                        effects.push({
                            type: "WRITE_FILES",
                            files: [
                                {
                                    name: conflict.fileName,
                                    content: conflict.remoteContent,
                                    modifiedAt: conflict.remoteModifiedAt ?? Date.now(),
                                },
                            ],
                            silent: true, // Auto-resolved during initial sync - no individual indicators
                        })
                    }
                }
            }

            if (remainingConflicts.length > 0) {
                effects.push(log("warn", `${pluralize(remainingConflicts.length, "conflict")} require resolution`), {
                    type: "REQUEST_CONFLICT_DECISIONS",
                    conflicts: remainingConflicts,
                })

                return {
                    state: {
                        ...state,
                        pendingConflicts: remainingConflicts,
                    },
                    effects,
                }
            }

            const resolvedCount = autoResolvedLocal.length + autoResolvedRemote.length
            effects.push(
                { type: "PERSIST_STATE" },
                {
                    type: "SYNC_COMPLETE",
                    totalCount: resolvedCount,
                    updatedCount: resolvedCount,
                    unchangedCount: 0,
                }
            )

            const { pendingConflicts: _discarded, ...rest } = state
            return {
                state: {
                    ...rest,
                    internalPhase: "watching",
                    pendingRemoteChanges: [],
                },
                effects,
            }
        }

        default: {
            effects.push(log("warn", `Unhandled event type in transition`))
            return { state, effects }
        }
    }
}

/**
 * Pure description of SEND_LOCAL_CHANGE for EffectResult-based tests and specs.
 */
export function describeSendLocalChange(effect: { fileName: string; content: string }, kernel: SyncKernel): EffectResult | null {
    const contentHash = hashFileContent(effect.content)
    const metadata = kernel.metadata.get(effect.fileName)

    if (metadata?.lastSyncedHash === contentHash) {
        debug(`Skipping local change for ${effect.fileName}: matches last synced content`)
        return null
    }

    if (kernel.shouldSkipInboundEcho(effect.fileName, effect.content)) {
        return null
    }

    debug(`Local change detected: ${effect.fileName}`)

    return {
        kernelOps: [{ op: "recordLocalSend", path: effect.fileName, content: effect.content }],
        sends: [
            {
                type: "file-change",
                fileName: effect.fileName,
                content: effect.content,
            },
        ],
        fileUp: effect.fileName,
        installerProcess: { fileName: effect.fileName, content: effect.content },
    }
}

function applyPreKernelOp(op: KernelOp, kernel: SyncKernel): void {
    const fileMetadataCache = kernel.metadata
    if (op.op === "recordLocalSend") {
        kernel.rememberLocalSend(op.path, op.content)
    } else if (op.op === "recordDelete") {
        kernel.forgetPath(op.path)
        fileMetadataCache.recordDelete(op.path)
    } else if (op.op === "registerPendingRename") {
        kernel.setPendingRename(op.newPath, {
            oldFileName: op.oldPath,
            content: op.content,
        })
    }
}

function applyPostKernelOp(op: KernelOp, kernel: SyncKernel): void {
    const fileMetadataCache = kernel.metadata
    if (op.op === "recordRemoteApplied") {
        const h = hashFileContent(op.content)
        fileMetadataCache.recordSyncedSnapshot(op.path, h, op.modifiedAt)
    } else if (op.op === "completePendingRename") {
        kernel.deletePendingRename(normalizeCodeFilePathWithExtension(op.newPath))
    } else if (op.op === "schedule" || op.op === "cancel") {
        warn(`KernelOp ${op.op} not wired on SyncKernel yet`)
    }
}

async function applyEffectResult(
    result: EffectResult,
    ctx: {
        kernel: SyncKernel
        config: Config
        syncState: SyncState
    }
): Promise<void> {
    const { kernel, config, syncState } = ctx
    const fileMetadataCache = kernel.metadata
    const peer = kernel.peerBaseView()
    const installer = kernel.installer

    if (result.log) {
        const logFns = { info, warn, success, debug }
        logFns[result.log.level](result.log.message)
    }

    const ops = result.kernelOps ?? []
    for (const op of ops) {
        if (isPreSendKernelOp(op)) {
            applyPreKernelOp(op, kernel)
        }
    }

    if (result.writes?.files && config.filesDir) {
        const filesToWrite =
            result.writes.skipEcho === true ? filterEchoedFiles(result.writes.files, peer) : result.writes.files

        if (filesToWrite.length > 0) {
            await writeRemoteFiles(filesToWrite, config.filesDir, peer, installer ?? undefined)
            for (const file of filesToWrite) {
                if (!result.writes.silent) {
                    fileDown(file.name)
                }
                const remoteTimestamp = file.modifiedAt ?? Date.now()
                fileMetadataCache.recordRemoteWrite(file.name, file.content, remoteTimestamp)
            }
        }
    }

    if (result.deletes && config.filesDir) {
        for (const fileName of result.deletes) {
            await deleteLocalFile(fileName, config.filesDir, peer)
            fileDelete(fileName)
            fileMetadataCache.recordDelete(fileName)
        }
    }

    if (result.sends && syncState.socket) {
        for (const payload of result.sends) {
            try {
                const sent = await sendMessage(syncState.socket, payload)
                if (sent && result.fileUp) {
                    fileUp(result.fileUp)
                }
                if (sent && result.installerProcess && installer) {
                    installer.process(result.installerProcess.fileName, result.installerProcess.content)
                }
            } catch {
                warn(
                    `Failed to push ${payload.type === "file-change" ? (payload as { fileName: string }).fileName : payload.type}`
                )
            }
        }
    }

    for (const op of ops) {
        if (!isPreSendKernelOp(op)) {
            applyPostKernelOp(op, kernel)
        }
    }

    if (result.persistState) {
        await fileMetadataCache.flush()
    }
}

/**
 * Effect executor - interprets effects and calls helpers
 * Returns additional events that should be processed (e.g., CONFLICTS_DETECTED after DETECT_CONFLICTS)
 */
interface ExecuteEffectContext {
    config: Config
    kernel: SyncKernel
    shutdown: () => Promise<void>
    syncState: SyncState
    /** When set (from `start()`), updates last-emitted phase for handshake re-emit. */
    sendSyncPhaseToPlugin?: (phase: SyncPhase) => Promise<void>
}

async function executeEffect(effect: Effect, context: ExecuteEffectContext): Promise<SyncEvent[]> {
    const { config, kernel, shutdown, syncState } = context
    const sendSyncPhase =
        context.sendSyncPhaseToPlugin ??
        (async (phase: SyncPhase) => {
            if (syncState.socket) {
                await sendMessage(syncState.socket, { type: "sync-phase", phase })
            }
        })
    const fileMetadataCache = kernel.metadata
    const peer = kernel.peerBaseView()
    const installer = kernel.installer

    switch (effect.type) {
        case "INIT_WORKSPACE": {
            // Initialize project directory if not already set
            if (!config.projectDir) {
                const projectName = config.explicitName ?? effect.projectInfo.projectName

                const directoryInfo = await findOrCreateProjectDirectory({
                    projectHash: config.projectHash,
                    projectName,
                    explicitDirectory: config.explicitDirectory,
                })
                config.projectDir = directoryInfo.directory
                config.projectDirCreated = directoryInfo.created

                if (directoryInfo.nameCollision) {
                    warn(`Folder ${projectName} already exists`)
                }

                // May allow customization of file directory in the future
                config.filesDir = `${config.projectDir}/files`
                debug(`Files directory: ${config.filesDir}`)
                await fs.mkdir(config.filesDir, { recursive: true })
            }
            return []
        }

        case "LOAD_PERSISTED_STATE": {
            if (config.projectDir) {
                await fileMetadataCache.initialize(config.projectDir)
                debug(`Loaded persisted metadata for ${pluralize(fileMetadataCache.size(), "file")}`)
            }
            return []
        }

        case "LIST_LOCAL_FILES": {
            if (!config.filesDir) {
                return []
            }

            // List all local files and send to plugin
            const files = await listFiles(config.filesDir)

            if (syncState.socket) {
                await sendMessage(syncState.socket, {
                    type: "file-list",
                    files,
                })
            }

            return []
        }

        case "DETECT_CONFLICTS": {
            if (!config.filesDir) {
                return []
            }

            // Use existing helper to detect conflicts
            const { conflicts, writes, localOnly, unchanged } = await detectConflicts(
                effect.remoteFiles,
                config.filesDir,
                { persistedState: fileMetadataCache.getPersistedState() }
            )

            // Record metadata for unchanged files so watcher add events get skipped
            // (chokidar ignoreInitial=false fires late adds that would otherwise re-upload)
            for (const file of unchanged) {
                fileMetadataCache.recordRemoteWrite(file.name, file.content, file.modifiedAt ?? Date.now())
            }

            // Return CONFLICTS_DETECTED event to continue the flow
            return [
                {
                    type: "CONFLICTS_DETECTED",
                    conflicts,
                    safeWrites: writes,
                    localOnly,
                },
            ]
        }

        case "SEND_MESSAGE": {
            if (syncState.socket) {
                const sent = await sendMessage(syncState.socket, effect.payload)
                if (!sent) {
                    warn(`Failed to send message: ${effect.payload.type}`)
                }
            } else {
                warn(`No socket available to send: ${effect.payload.type}`)
            }
            return []
        }

        case "EMIT_SYNC_PHASE": {
            await sendSyncPhase(effect.phase)
            return []
        }

        case "WRITE_FILES": {
            if (config.filesDir) {
                // skipEcho skip writes that match peer echo state (inbound echo)
                // it is opt-in: some callers still need side-effects (metadata/logs)
                // even when content matches the last hash tracked in-memory.
                const filesToWrite =
                    effect.skipEcho === true ? filterEchoedFiles(effect.files, peer) : effect.files

                if (effect.skipEcho && filesToWrite.length !== effect.files.length) {
                    const skipped = effect.files.length - filesToWrite.length
                    debug(`Skipped ${pluralize(skipped, "echoed change")}`)
                }

                if (filesToWrite.length === 0) {
                    return []
                }

                await writeRemoteFiles(filesToWrite, config.filesDir, peer, installer ?? undefined)
                for (const file of filesToWrite) {
                    if (!effect.silent) {
                        fileDown(file.name)
                    }
                    const remoteTimestamp = file.modifiedAt ?? Date.now()
                    fileMetadataCache.recordRemoteWrite(file.name, file.content, remoteTimestamp)
                }
            }
            return []
        }

        case "DELETE_LOCAL_FILES": {
            if (config.filesDir) {
                for (const fileName of effect.names) {
                    await deleteLocalFile(fileName, config.filesDir, peer)
                    fileDelete(fileName)
                    fileMetadataCache.recordDelete(fileName)
                }
            }
            return []
        }

        case "REQUEST_CONFLICT_DECISIONS": {
            await kernel.requestConflictDecisions(syncState.socket, effect.conflicts)

            return []
        }

        case "REQUEST_CONFLICT_VERSIONS": {
            if (!syncState.socket) {
                warn("Cannot request conflict versions without active socket")
                return []
            }

            const persistedState = fileMetadataCache.getPersistedState()
            const versionRequests = effect.conflicts.map(conflict => {
                const persisted = persistedState.get(conflict.fileName)
                return {
                    fileName: conflict.fileName,
                    lastSyncedAt: conflict.lastSyncedAt ?? persisted?.timestamp,
                }
            })

            debug(`Requesting remote version data for ${pluralize(versionRequests.length, "file")}`)

            await sendMessage(syncState.socket, {
                type: "conflict-version-request",
                conflicts: versionRequests,
            })

            return []
        }

        case "UPDATE_FILE_METADATA": {
            if (!config.filesDir || !config.projectDir) {
                return []
            }

            // Read current file content to compute hash
            const currentContent = await readFileSafe(effect.fileName, config.filesDir)
            // Rename cleanup waits for the plugin's file-synced acknowledgment.
            const pendingRenameConfirmation = kernel.getPendingRename(normalizeCodeFilePathWithExtension(effect.fileName))
            const syncedContent = currentContent ?? pendingRenameConfirmation?.content ?? null

            if (syncedContent !== null) {
                const contentHash = hashFileContent(syncedContent)
                fileMetadataCache.recordSyncedSnapshot(effect.fileName, contentHash, effect.remoteModifiedAt)
            }

            if (pendingRenameConfirmation) {
                kernel.forgetPath(pendingRenameConfirmation.oldFileName)
                fileMetadataCache.recordDelete(pendingRenameConfirmation.oldFileName)
                if (currentContent !== null) {
                    kernel.rememberLocalSend(effect.fileName, currentContent)
                }
                kernel.deletePendingRename(normalizeCodeFilePathWithExtension(effect.fileName))
            }

            return []
        }

        case "SEND_LOCAL_CHANGE": {
            const described = describeSendLocalChange(effect, kernel)
            if (!described) {
                return []
            }

            try {
                await applyEffectResult(described, {
                    kernel,
                    config,
                    syncState,
                })
            } catch (err) {
                warn(`Failed to push ${effect.fileName}`)
            }

            return []
        }

        case "SEND_FILE_RENAME": {
            const normalizedNewFileName = normalizeCodeFilePathWithExtension(effect.newFileName)
            const isEchoedRename =
                kernel.shouldSkipInboundEcho(normalizedNewFileName, effect.content) &&
                kernel.shouldSkipDeleteEcho(effect.oldFileName)

            if (isEchoedRename) {
                kernel.forgetPath(normalizedNewFileName)
                kernel.clearDeleteTombstone(effect.oldFileName)
                debug(`Skipping echoed rename ${effect.oldFileName} -> ${effect.newFileName}`)
                return []
            }

            try {
                if (!syncState.socket) {
                    warn(`No socket available to send rename ${effect.oldFileName} -> ${effect.newFileName}`)
                    return []
                }

                const sent = await sendMessage(syncState.socket, {
                    type: "file-rename",
                    oldFileName: effect.oldFileName,
                    newFileName: normalizedNewFileName,
                    content: effect.content,
                })
                if (!sent) {
                    warn(`Failed to send rename ${effect.oldFileName} -> ${effect.newFileName}`)
                    return []
                }

                kernel.setPendingRename(normalizeCodeFilePathWithExtension(effect.newFileName), {
                    oldFileName: effect.oldFileName,
                    content: effect.content,
                })
            } catch (err) {
                warn(`Failed to send rename ${effect.oldFileName} -> ${effect.newFileName}`)
            }

            return []
        }

        case "LOCAL_INITIATED_FILE_DELETE": {
            // Echo prevention: filter out remote-initiated deletes
            const filesToDelete = effect.fileNames.filter(fileName => {
                const shouldSkip = kernel.shouldSkipDeleteEcho(fileName)
                if (shouldSkip) {
                    kernel.clearDeleteTombstone(fileName)
                }
                return !shouldSkip
            })

            if (filesToDelete.length === 0) {
                return []
            }

            try {
                const confirmedFiles = await kernel.requestDeleteDecision(syncState.socket, {
                    fileNames: filesToDelete,
                    requireConfirmation: !config.dangerouslyAutoDelete,
                })

                for (const fileName of confirmedFiles) {
                    kernel.forgetPath(fileName)
                    fileMetadataCache.recordDelete(fileName)
                    fileDelete(fileName)
                }

                if (confirmedFiles.length > 0 && syncState.socket) {
                    await sendMessage(syncState.socket, {
                        type: "file-delete",
                        fileNames: confirmedFiles,
                    })
                }
            } catch (err) {
                console.warn(`Failed to handle deletion for ${filesToDelete.join(", ")}:`, err)
            }

            return []
        }

        case "PERSIST_STATE": {
            await fileMetadataCache.flush()
            return []
        }

        case "SYNC_COMPLETE": {
            const shutdownIfOneOffSync = async () => {
                if (!config.once) return false

                status("Sync complete, exiting...")
                await shutdown()
                return true
            }

            const wasDisconnected = kernel.disconnectUi.wasRecentlyDisconnected()

            if (wasDisconnected) {
                // Only show reconnect message if we actually showed the disconnect notice
                if (kernel.disconnectUi.didShowNotice()) {
                    success(
                        `Reconnected, synced ${pluralize(effect.totalCount, "file")} (${effect.updatedCount} updated, ${effect.unchangedCount} unchanged)`
                    )
                    await sendSyncPhase("ready")
                    if (!await shutdownIfOneOffSync()) status("Watching for changes...")
                } else {
                    await sendSyncPhase("ready")
                }
                kernel.disconnectUi.reset()
                return []
            }

            const relative = config.projectDir ? path.relative(process.cwd(), config.projectDir) : null
            const relativeDirectory = relative != null ? (relative ? "./" + relative : ".") : null

            if (effect.totalCount === 0 && relativeDirectory) {
                if (config.projectDirCreated) {
                    success(`Created ${relativeDirectory} folder`)
                } else {
                    success(`Syncing to ${relativeDirectory} folder`)
                }
            } else if (relativeDirectory && config.projectDirCreated) {
                success(`Created ${relativeDirectory} (${pluralize(effect.updatedCount, "file")} added)`)
            } else if (relativeDirectory) {
                success(
                    `Synced into ${relativeDirectory} (${pluralize(effect.updatedCount, "file")} updated, ${effect.unchangedCount} unchanged)`
                )
            } else {
                success(
                    `Synced ${pluralize(effect.totalCount, "file")} (${effect.updatedCount} updated, ${effect.unchangedCount} unchanged)`
                )
            }
            // Git init after first sync so initial commit includes all synced files
            if (config.projectDirCreated && config.projectDir) {
                tryGitInit(config.projectDir)
            }

            // Effect-stable: plugin only sees `ready` after this handler's work (including git init).
            await sendSyncPhase("ready")

            if (!await shutdownIfOneOffSync()) status("Watching for changes...")
            return []
        }

        case "LOG": {
            const logFns = { info, warn, success, debug }
            const logFn = logFns[effect.level]
            logFn(effect.message)
            return []
        }
    }
}

/**
 * Starts the sync controller with the given configuration
 */
export async function start(config: Config): Promise<void> {
    const kernel = new SyncKernel()
    let isShuttingDown = false

    // State machine state
    let syncState: SyncState = {
        internalPhase: "disconnected",
        socket: null,
        pendingRemoteChanges: [],
    }

    /** Last sync-phase sent to the plugin (for re-emit on duplicate handshake). */
    let lastEmittedSyncPhase: SyncPhase | null = null

    const sendSyncPhaseToPlugin = async (phase: SyncPhase) => {
        lastEmittedSyncPhase = phase
        if (syncState.socket) {
            await sendMessage(syncState.socket, { type: "sync-phase", phase })
        }
    }

    const eventQueue = createEventQueue()

    // Top-level ingress (WS, watcher, disconnect) serializes through the queue — one event at a time.
    // Follow-up events from `executeEffect` run inline on the same turn (no re-enqueue) to avoid deadlock.
    function processEvent(event: SyncEvent): Promise<void> {
        return eventQueue.enqueue(() => processEventInner(event))
    }

    async function processEventInner(event: SyncEvent) {
        const socketState = syncState.socket?.readyState
        debug(
            `[STATE] Processing event: ${event.type} (internalPhase: ${syncState.internalPhase}, socket: ${socketState ?? "none"})`
        )

        const result = transition(syncState, event, {
            wasRecentlyDisconnected: () => kernel.disconnectUi.wasRecentlyDisconnected(),
        })
        syncState = result.state

        if (result.effects.length > 0) {
            debug(
                `[STATE] Event produced ${result.effects.length} effects: ${result.effects.map(e => e.type).join(", ")}`
            )
        }

        // Execute all effects and process any follow-up events
        for (const effect of result.effects) {
            // Check socket state before each effect
            const currentSocketState = syncState.socket?.readyState
            if (currentSocketState !== undefined && currentSocketState !== 1) {
                debug(`[STATE] Socket not open (state: ${currentSocketState}) before executing ${effect.type}`)
            }

            const followUpEvents = await executeEffect(effect, {
                config,
                kernel,
                shutdown,
                syncState,
                sendSyncPhaseToPlugin,
            })

            // Follow-ups must not re-enter the serial queue (parent still holds the queue slot).
            for (const followUpEvent of followUpEvents) {
                await processEventInner(followUpEvent)
            }
        }
    }

    // TLS certificates for WSS — required for browser connection
    const certs = await getOrCreateCerts()
    if (!certs) {
        error("Failed to generate TLS certificates. The Framer plugin requires a secure (wss://) connection.")
        info("")
        info("To fix this:")
        info("  1. Re-run this command — certificate generation is often a one-time issue")
        info(`  2. Manually delete "${CERT_DIR}" and try again`)
        info("")
        throw new Error("TLS certificate generation failed")
    }

    status("Waiting for Plugin connection...")

    // WebSocket Connection (always WSS)
    const connection = await initConnection(config.port, certs)

    // Handle initial handshake
    connection.on("handshake", (client: WebSocket, message) => {
        debug(`Received handshake: ${message.projectName} (${message.projectId})`)

        // Validate project hash (normalize both to short hash for comparison)
        const expectedShort = shortProjectHash(config.projectHash)
        const receivedShort = shortProjectHash(message.projectId)
        if (receivedShort !== expectedShort) {
            warn(`Project ID mismatch: expected ${expectedShort}, got ${receivedShort}`)
            client.close()
            return
        }

        void (async () => {
            kernel.disconnectUi.cancelNotice()

            if (syncState.internalPhase !== "disconnected") {
                if (syncState.socket === client) {
                    debug(`Ignoring duplicate handshake from active socket (internalPhase=${syncState.internalPhase})`)
                    void sendSyncPhaseToPlugin(lastEmittedSyncPhase ?? "initial_sync")
                    return
                }
                debug(`New handshake received (internalPhase=${syncState.internalPhase}), resetting sync state`)
                kernel.clearPendingRenames()
                await processEvent({ type: "DISCONNECT" })
            }

            kernel.mintConnectionId()

            // Only show "Connected" on initial connection, not reconnects
            // Reconnect confirmation happens in SYNC_COMPLETE
            const wasDisconnected = kernel.disconnectUi.wasRecentlyDisconnected()
            if (!wasDisconnected && !kernel.disconnectUi.didShowNotice()) {
                success(`Connected to ${message.projectName}`)
            }

            // Process handshake through state machine
            await processEvent({
                type: "HANDSHAKE",
                socket: client,
                projectInfo: {
                    projectId: message.projectId,
                    projectName: message.projectName,
                },
            })

            // Initialize installer if needed
            if (config.projectDir && !kernel.installer) {
                kernel.installer = new Installer({
                    projectDir: config.projectDir,
                    allowUnsupportedNpm: config.allowUnsupportedNpm,
                })
                await kernel.installer.initialize()
                // Start file watcher now that we have a directory
                startWatcher()
            }
        })()
    })

    // Message Handler
    async function handleMessage(message: PluginToCliMessage) {
        // Ensure project is initialized before handling messages
        if (!config.projectDir || !kernel.installer) {
            warn("Received message before handshake completed - ignoring")
            return
        }

        let event: SyncEvent | null = null

        // Map incoming messages to state machine events
        switch (message.type) {
            case "request-files":
                event = { type: "REQUEST_FILES" }
                break

            case "file-list": {
                debug(`Received file list: ${pluralize(message.files.length, "file")}`)
                event = { type: "REMOTE_FILE_LIST", files: message.files }
                break
            }

            case "file-change":
                event = {
                    type: "REMOTE_FILE_CHANGE",
                    file: {
                        name: message.fileName,
                        content: message.content,
                        // Remote modifiedAt is expensive to compute (requires getVerions API call), so we
                        // use local receipt time. Conflict detection uses content hashes, not timestamps.
                        modifiedAt: Date.now(),
                    },
                    fileMeta: kernel.metadata.get(message.fileName),
                }
                break

            case "file-delete": {
                // Remote deletes are always applied immediately (file is already gone from Framer)
                for (const fileName of message.fileNames) {
                    await processEvent({
                        type: "REMOTE_FILE_DELETE",
                        fileName,
                    })
                }
                return
            }

            case "delete-confirmed": {
                if (!message.session || message.session.connectionId !== kernel.connectionId) {
                    warn("Ignoring stale delete-confirmed (session mismatch)")
                    return
                }
                const { session } = message
                for (const fileName of message.fileNames) {
                    const handled = kernel.resolvePendingAction(deletePromptActionId(session, fileName), true)

                    if (!handled) {
                        warn(`Ignoring stale delete confirmation for ${fileName}`)
                    }
                }

                return
            }

            case "delete-cancelled": {
                if (!message.session || message.session.connectionId !== kernel.connectionId) {
                    warn("Ignoring stale delete-cancelled (session mismatch)")
                    return
                }
                const { session } = message
                for (const file of message.files) {
                    const handled = kernel.resolvePendingAction(deletePromptActionId(session, file.fileName), false)
                    if (!handled) {
                        warn(`Ignoring stale delete cancellation for ${file.fileName}`)
                        continue
                    }

                    await processEvent({
                        type: "LOCAL_DELETE_REJECTED",
                        fileName: file.fileName,
                        content: file.content,
                    })
                }

                return
            }

            case "file-synced":
                event = {
                    type: "FILE_SYNCED_CONFIRMATION",
                    fileName: message.fileName,
                    remoteModifiedAt: message.remoteModifiedAt,
                }
                break

            case "error":
                if (message.fileName) {
                    kernel.deletePendingRename(normalizeCodeFilePathWithExtension(message.fileName))
                }
                warn(message.message)
                return

            case "conflicts-resolved": {
                if (!message.session || message.session.connectionId !== kernel.connectionId) {
                    warn("Ignoring stale conflicts-resolved (session mismatch)")
                    return
                }
                const { session, resolution, fileNames } = message
                for (const fileName of fileNames) {
                    kernel.resolvePendingAction(conflictPromptActionId(session, fileName), resolution)
                }
                event = {
                    type: "CONFLICTS_RESOLVED",
                    resolution,
                }
                break
            }

            case "conflict-version-response":
                event = {
                    type: "CONFLICT_VERSION_RESPONSE",
                    versions: message.versions,
                }
                break

            default:
                warn(`Unhandled message type: ${message.type}`)
                return
        }

        await processEvent(event)
    }

    connection.on("message", (message: PluginToCliMessage) => {
        void (async () => {
            try {
                await handleMessage(message)
            } catch (err) {
                error("Error handling message:", err)
            }
        })()
    })

    connection.on("disconnect", (client: WebSocket) => {
        if (isShuttingDown) {
            debug("[STATE] Ignoring disconnect during shutdown")
            return
        }
        if (syncState.socket !== client) {
            debug("[STATE] Ignoring disconnect from stale socket")
            return
        }
        // Schedule disconnect message with delay - if reconnect happens quickly, we skip it
        kernel.disconnectUi.scheduleNotice(() => {
            status("Disconnected, waiting to reconnect...")
        })
        void (async () => {
            kernel.clearPendingRenames()
            await processEvent({ type: "DISCONNECT" })
            lastEmittedSyncPhase = null
            kernel.cleanupUserActions()
        })()
    })

    connection.on("error", err => {
        error("Error on WebSocket connection:", err)
    })

    // File Watcher Setup
    // Watcher will be initialized after handshake when filesDir is set
    let watcher: ReturnType<typeof initWatcher> | null = null

    const shutdown = async () => {
        if (isShuttingDown) return

        debug("[STATE] Shutting down...")

        isShuttingDown = true
        kernel.cleanupUserActions()

        if (watcher) {
            await watcher.close()
            watcher = null
        }

        connection.close()
    }

    const startWatcher = () => {
        if (!config.filesDir || watcher) return
        watcher = initWatcher(config.filesDir)

        watcher.on("change", event => {
            void processEvent({ type: "WATCHER_EVENT", event })
        })
    }

    // Graceful shutdown
    process.on("SIGINT", () => {
        console.log() // newline after ^C
        status("Shutting down...")
        void (async () => {
            await shutdown()
            process.exit(0)
        })()
    })
}

// Export for testing
export { executeEffect, transition }
