/**
 * CLI Controller
 *
 * All runtime state and orchestration of the sync lifecycle.
 * Helpers should provide data and never hold control.
 */

import type { CliToPluginMessage, PluginToCliMessage } from "@code-link/shared"
import { pluralize, shortProjectHash } from "@code-link/shared"
import fs from "fs/promises"
import path from "path"
import type { WebSocket } from "ws"
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
import { Installer } from "./helpers/installer.ts"
import { PluginUserPromptCoordinator } from "./helpers/plugin-prompts.ts"
import { validateIncomingChange } from "./helpers/sync-validator.ts"
import { initWatcher } from "./helpers/watcher.ts"
import type { Config, Conflict, ConflictVersionData, FileInfo, WatcherEvent } from "./types.ts"
import { FileMetadataCache, type FileSyncMetadata } from "./utils/file-metadata-cache.ts"
import { createHashTracker } from "./utils/hash-tracker.ts"
import {
    cancelDisconnectMessage,
    debug,
    didShowDisconnect,
    error,
    fileDelete,
    fileDown,
    fileUp,
    info,
    resetDisconnectState,
    scheduleDisconnectMessage,
    status,
    success,
    warn,
    wasRecentlyDisconnected,
} from "./utils/logging.ts"
import { findOrCreateProjectDirectory } from "./utils/project.ts"
import { hashFileContent } from "./utils/state-persistence.ts"

/**
 * Explicit sync lifecycle modes
 */
export type SyncMode = "disconnected" | "handshaking" | "snapshot_processing" | "conflict_resolution" | "watching"

/**
 * Shared state that persists across all lifecycle modes
 */
interface SyncStateBase {
    pendingRemoteChanges: FileInfo[]
}

type DisconnectedState = SyncStateBase & {
    mode: "disconnected"
    socket: null
}

type HandshakingState = SyncStateBase & {
    mode: "handshaking"
    socket: WebSocket
}

type SnapshotProcessingState = SyncStateBase & {
    mode: "snapshot_processing"
    socket: WebSocket
}

type ConflictResolutionState = SyncStateBase & {
    mode: "conflict_resolution"
    socket: WebSocket
    pendingConflicts: Conflict[]
}

type WatchingState = SyncStateBase & {
    mode: "watching"
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

/**
 * Pure state transition function
 * Takes current state + event, returns new state + effects to execute
 */
function transition(state: SyncState, event: SyncEvent): { state: SyncState; effects: Effect[] } {
    const effects: Effect[] = []

    switch (event.type) {
        case "HANDSHAKE": {
            if (state.mode !== "disconnected") {
                effects.push(log("warn", `Received HANDSHAKE in mode ${state.mode}, ignoring`))
                return { state, effects }
            }

            effects.push(
                { type: "INIT_WORKSPACE", projectInfo: event.projectInfo },
                { type: "LOAD_PERSISTED_STATE" },
                { type: "SEND_MESSAGE", payload: { type: "request-files" } }
            )

            return {
                state: {
                    ...state,
                    mode: "handshaking",
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

            if (state.mode === "conflict_resolution") {
                const { pendingConflicts: _discarded, ...rest } = state
                return {
                    state: {
                        ...rest,
                        mode: "disconnected",
                        socket: null,
                    },
                    effects,
                }
            }

            return {
                state: {
                    ...state,
                    mode: "disconnected",
                    socket: null,
                },
                effects,
            }
        }

        case "REQUEST_FILES": {
            // Plugin is asking for our local file list
            // Valid in any mode except disconnected
            if (state.mode === "disconnected") {
                effects.push(log("warn", "Received REQUEST_FILES while disconnected, ignoring"))
                return { state, effects }
            }

            effects.push(log("debug", "Plugin requested file list"), {
                type: "LIST_LOCAL_FILES",
            })

            return { state, effects }
        }

        case "REMOTE_FILE_LIST": {
            if (state.mode !== "handshaking") {
                effects.push(log("warn", `Received REMOTE_FILE_LIST in mode ${state.mode}, ignoring`))
                return { state, effects }
            }

            effects.push(log("debug", `Received file list: ${event.files.length} files`))

            // During initial file list, detect conflicts between remote snapshot and local files
            effects.push({
                type: "DETECT_CONFLICTS",
                remoteFiles: event.files,
            })

            // Transition to snapshot_processing - conflict detection effect will determine next mode
            return {
                state: {
                    ...state,
                    mode: "snapshot_processing",
                    pendingRemoteChanges: event.files,
                },
                effects,
            }
        }

        case "CONFLICTS_DETECTED": {
            if (state.mode !== "snapshot_processing") {
                effects.push(log("warn", `Received CONFLICTS_DETECTED in mode ${state.mode}, ignoring`))
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
                effects.push(log("debug", `Applying ${safeWrites.length} safe writes`), {
                    type: "WRITE_FILES",
                    files: safeWrites,
                    silent: true,
                })
            }

            // Upload local-only files
            if (localOnly.length > 0) {
                effects.push(log("debug", `Uploading ${localOnly.length} local-only files`))
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
                        mode: "conflict_resolution",
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
                    mode: "watching",
                    pendingRemoteChanges: [],
                },
                effects,
            }
        }

        case "REMOTE_FILE_CHANGE": {
            // Use helper to validate the incoming change
            const validation = validateIncomingChange(event.fileMeta, state.mode)

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
            if (state.mode === "disconnected") {
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
            if (state.mode !== "conflict_resolution") {
                effects.push(log("warn", `Received CONFLICTS_RESOLVED in mode ${state.mode}, ignoring`))
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
                    mode: "watching",
                },
                effects,
            }
        }

        case "WATCHER_EVENT": {
            // Local file system change detected
            const { kind, relativePath, content } = event.event

            // Only process changes in watching mode
            if (state.mode !== "watching") {
                effects.push(log("debug", `Ignoring watcher event in ${state.mode} mode: ${kind} ${relativePath}`))
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
            }

            return { state, effects }
        }

        case "CONFLICT_VERSION_RESPONSE": {
            if (state.mode !== "conflict_resolution") {
                effects.push(log("warn", `Received CONFLICT_VERSION_RESPONSE in mode ${state.mode}, ignoring`))
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
                    mode: "watching",
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
 * Effect executor - interprets effects and calls helpers
 * Returns additional events that should be processed (e.g., CONFLICTS_DETECTED after DETECT_CONFLICTS)
 */
async function executeEffect(
    effect: Effect,
    context: {
        config: Config
        hashTracker: ReturnType<typeof createHashTracker>
        installer: Installer | null
        fileMetadataCache: FileMetadataCache
        userActions: PluginUserPromptCoordinator
        syncState: SyncState
    }
): Promise<SyncEvent[]> {
    const { config, hashTracker, installer, fileMetadataCache, userActions, syncState } = context

    switch (effect.type) {
        case "INIT_WORKSPACE": {
            // Initialize project directory if not already set
            if (!config.projectDir) {
                const projectName = config.explicitName ?? effect.projectInfo.projectName

                const directoryInfo = await findOrCreateProjectDirectory(
                    config.projectHash,
                    projectName,
                    config.explicitDirectory
                )
                config.projectDir = directoryInfo.directory
                config.projectDirCreated = directoryInfo.created

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
                debug(`Loaded persisted metadata for ${fileMetadataCache.size()} files`)
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

        case "WRITE_FILES": {
            if (config.filesDir) {
                // skipEcho skip writes that match hashTracker (inbound echo)
                // it is opt-in: some callers still need side-effects (metadata/logs)
                // even when content matches the last hash tracked in-memory.
                const filesToWrite =
                    effect.skipEcho === true ? filterEchoedFiles(effect.files, hashTracker) : effect.files

                if (effect.skipEcho && filesToWrite.length !== effect.files.length) {
                    const skipped = effect.files.length - filesToWrite.length
                    debug(`Skipped ${pluralize(skipped, "echoed change")}`)
                }

                if (filesToWrite.length === 0) {
                    return []
                }

                await writeRemoteFiles(filesToWrite, config.filesDir, hashTracker, installer ?? undefined)
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
                    await deleteLocalFile(fileName, config.filesDir, hashTracker)
                    fileDelete(fileName)
                    fileMetadataCache.recordDelete(fileName)
                }
            }
            return []
        }

        case "REQUEST_CONFLICT_DECISIONS": {
            await userActions.requestConflictDecisions(syncState.socket, effect.conflicts)

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

            if (currentContent !== null) {
                const contentHash = hashFileContent(currentContent)
                fileMetadataCache.recordSyncedSnapshot(effect.fileName, contentHash, effect.remoteModifiedAt)
            }

            return []
        }

        case "SEND_LOCAL_CHANGE": {
            const contentHash = hashFileContent(effect.content)
            const metadata = fileMetadataCache.get(effect.fileName)

            // Skip if file matches last confirmed remote content
            if (metadata?.lastSyncedHash === contentHash) {
                debug(`Skipping local change for ${effect.fileName}: matches last synced content`)
                return []
            }

            // Echo prevention: skip if we just wrote this exact content
            if (hashTracker.shouldSkip(effect.fileName, effect.content)) {
                return []
            }

            debug(`Local change detected: ${effect.fileName}`)

            try {
                // Send change to plugin
                if (syncState.socket) {
                    await sendMessage(syncState.socket, {
                        type: "file-change",
                        fileName: effect.fileName,
                        content: effect.content,
                    })
                    fileUp(effect.fileName)
                }

                // Only remember hash after successful send (prevents re-sending on failure)
                hashTracker.remember(effect.fileName, effect.content)

                // Trigger type installer
                if (installer) {
                    installer.process(effect.fileName, effect.content)
                }
            } catch (err) {
                warn(`Failed to push ${effect.fileName}`)
            }

            return []
        }

        case "LOCAL_INITIATED_FILE_DELETE": {
            // Echo prevention: filter out remote-initiated deletes
            const filesToDelete = effect.fileNames.filter(fileName => {
                const shouldSkip = hashTracker.shouldSkipDelete(fileName)
                if (shouldSkip) {
                    hashTracker.clearDelete(fileName)
                }
                return !shouldSkip
            })

            if (filesToDelete.length === 0) {
                return []
            }

            try {
                const confirmedFiles = await userActions.requestDeleteDecision(syncState.socket, {
                    fileNames: filesToDelete,
                    requireConfirmation: !config.dangerouslyAutoDelete,
                })

                for (const fileName of confirmedFiles) {
                    hashTracker.forget(fileName)
                    fileMetadataCache.recordDelete(fileName)
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
            const wasDisconnected = wasRecentlyDisconnected()

            // Notify plugin that sync is complete
            if (syncState.socket) {
                await sendMessage(syncState.socket, { type: "sync-complete" })
            }

            if (wasDisconnected) {
                // Only show reconnect message if we actually showed the disconnect notice
                if (didShowDisconnect()) {
                    success(
                        `Reconnected, synced ${effect.totalCount} files (${effect.updatedCount} updated, ${effect.unchangedCount} unchanged)`
                    )
                    status("Watching for changes...")
                }
                resetDisconnectState()
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
                success(`Synced into ${relativeDirectory} (${effect.updatedCount} files added)`)
            } else if (relativeDirectory) {
                success(
                    `Synced into ${relativeDirectory} (${effect.updatedCount} files updated, ${effect.unchangedCount} unchanged)`
                )
            } else {
                success(
                    `Synced ${effect.totalCount} files (${effect.updatedCount} updated, ${effect.unchangedCount} unchanged)`
                )
            }
            // Git init after first sync so initial commit includes all synced files
            if (config.projectDirCreated && config.projectDir) {
                tryGitInit(config.projectDir)
            }

            status("Watching for changes...")
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
    status("Waiting for Plugin connection...")

    const hashTracker = createHashTracker()
    const fileMetadataCache = new FileMetadataCache()
    let installer: Installer | null = null

    // State machine state
    let syncState: SyncState = {
        mode: "disconnected",
        socket: null,
        pendingRemoteChanges: [],
    }

    const userActions = new PluginUserPromptCoordinator()

    // State Machine Helper
    // Process events through state machine and execute effects recursively
    async function processEvent(event: SyncEvent) {
        const socketState = syncState.socket?.readyState
        debug(`[STATE] Processing event: ${event.type} (mode: ${syncState.mode}, socket: ${socketState ?? "none"})`)

        const result = transition(syncState, event)
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
                hashTracker,
                installer,
                fileMetadataCache,
                userActions,
                syncState,
            })

            // Recursively process follow-up events
            for (const followUpEvent of followUpEvents) {
                await processEvent(followUpEvent)
            }
        }
    }

    // WebSocket Connection
    const connection = await initConnection(config.port)

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
            cancelDisconnectMessage()

            // Only show "Connected" on initial connection, not reconnects
            // Reconnect confirmation happens in SYNC_COMPLETE
            const wasDisconnected = wasRecentlyDisconnected()
            if (!wasDisconnected && !didShowDisconnect()) {
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
            if (config.projectDir && !installer) {
                installer = new Installer({
                    projectDir: config.projectDir,
                    allowUnsupportedNpm: config.allowUnsupportedNpm,
                })
                await installer.initialize()
                // Start file watcher now that we have a directory
                startWatcher()
            }
        })()
    })

    // Message Handler
    async function handleMessage(message: PluginToCliMessage) {
        // Ensure project is initialized before handling messages
        if (!config.projectDir || !installer) {
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
                debug(`Received file list: ${message.files.length} files`)
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
                    fileMeta: fileMetadataCache.get(message.fileName),
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
                const unmatched: string[] = []

                for (const fileName of message.fileNames) {
                    const handled = userActions.handleConfirmation(`delete:${fileName}`, true)

                    if (!handled) {
                        unmatched.push(fileName)
                    }
                }

                for (const fileName of unmatched) {
                    await processEvent({ type: "LOCAL_DELETE_APPROVED", fileName })
                }

                return
            }

            case "delete-cancelled": {
                for (const file of message.files) {
                    userActions.handleConfirmation(`delete:${file.fileName}`, false)

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

            case "conflicts-resolved":
                event = {
                    type: "CONFLICTS_RESOLVED",
                    resolution: message.resolution,
                }
                break

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

    connection.on("disconnect", () => {
        // Schedule disconnect message with delay - if reconnect happens quickly, we skip it
        scheduleDisconnectMessage(() => {
            status("Disconnected, waiting to reconnect...")
        })
        void (async () => {
            await processEvent({ type: "DISCONNECT" })
            userActions.cleanup()
        })()
    })

    connection.on("error", err => {
        error("Error on WebSocket connection:", err)
    })

    // File Watcher Setup
    // Watcher will be initialized after handshake when filesDir is set
    let watcher: ReturnType<typeof initWatcher> | null = null

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
            if (watcher) {
                await watcher.close()
            }
            connection.close()
            process.exit(0)
        })()
    })
}

// Export for testing
export { transition }
