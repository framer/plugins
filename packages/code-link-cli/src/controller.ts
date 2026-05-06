/**
 * CLI Controller
 *
 * Trace for any sync change:
 *
 *   1. transition(state, event)        — next state + Effect[], no side effects
 *   2. applyEffect(effect, ctx)        — main place that mutates or does I/O
 */

import type { CliToPluginMessage, PluginToCliMessage } from "@code-link/shared"
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
import { Installer } from "./helpers/installer.ts"
import { initWatcher } from "./helpers/watcher.ts"
import { type ConflictPromptChange, SyncRuntime } from "./runtime.ts"
import type { Effect, SyncEvent, SyncState, WriteEchoPolicy } from "./sync-events.ts"
import type { Config, Conflict, FileInfo } from "./types.ts"
import {
    debug,
    error,
    fileDelete,
    fileDown,
    fileUp,
    info,
    type LogEntryLevel,
    status,
    success,
    warn,
} from "./utils/logging.ts"
import { findOrCreateProjectDirectory } from "./utils/project.ts"
import { hashFileContent } from "./utils/state-persistence.ts"

export type { SyncState } from "./sync-events.ts"

function createEventQueue(): {
    enqueue<T>(fn: () => Promise<T>): Promise<T>
} {
    let tail: Promise<unknown> = Promise.resolve()

    return {
        enqueue<T>(fn: () => Promise<T>): Promise<T> {
            const run = tail.then(() => fn())
            tail = run.catch(() => {
                /* keep chain alive */
            })
            return run
        },
    }
}

/** Log helper */
function log(level: LogEntryLevel, message: string): Effect {
    return { type: "LOG", level, message }
}

export interface TransitionRead {
    wasRecentlyDisconnected?: () => boolean
    isActiveConflictPath?: (path: string) => boolean
    isActiveDeletePromptPath?: (path: string) => boolean
}

function updatePendingConflictRemote(
    pendingConflicts: Conflict[],
    fileName: string,
    content: string | null,
    modifiedAt?: number
): { changed: boolean; conflicts: Conflict[] } {
    const normalized = normalizeCodeFilePathWithExtension(fileName)
    let changed = false
    const conflicts = pendingConflicts.map(conflict => {
        if (normalizeCodeFilePathWithExtension(conflict.fileName) !== normalized) return conflict
        changed = true
        return {
            ...conflict,
            fileName: normalized,
            remoteContent: content,
            remoteModifiedAt: modifiedAt,
        }
    })
    return { changed, conflicts }
}

/**
 * State transition
 * Takes current state + event, returns new state + effects to execute
 */
function transition(
    state: SyncState,
    event: SyncEvent,
    read: TransitionRead = {}
): { state: SyncState; effects: Effect[] } {
    const effects: Effect[] = []

    switch (event.type) {
        case "HANDSHAKE": {
            if (state.phase !== "disconnected") {
                effects.push(log("warn", `Received HANDSHAKE in phase=${state.phase}, ignoring`))
                return { state, effects }
            }

            effects.push(
                { type: "INIT_WORKSPACE", projectInfo: event.projectInfo },
                { type: "LOAD_PERSISTED_STATE" },
                { type: "SEND_MESSAGE", payload: { type: "request-files" } },
                { type: "EMIT_SYNC_STATUS", status: "initial_sync" }
            )

            return {
                state: { phase: "handshaking", socket: event.socket },
                effects,
            }
        }

        case "RESEND_SYNC_STATUS": {
            // Duplicate handshake from already-active socket — re-announce current status.
            effects.push(log("debug", `Re-emitting sync-status=${event.status} for duplicate handshake`), {
                type: "EMIT_SYNC_STATUS",
                status: event.status,
            })
            return { state, effects }
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
            return {
                state: { phase: "disconnected", socket: null },
                effects,
            }
        }

        case "REQUEST_FILES": {
            // Plugin is asking for our local file list
            // Valid in any mode except disconnected
            if (state.phase === "disconnected") {
                effects.push(log("warn", "Received REQUEST_FILES while disconnected, ignoring"))
                return { state, effects }
            }

            effects.push(log("debug", "Plugin requested file list"), {
                type: "LIST_LOCAL_FILES",
            })

            return { state, effects }
        }

        case "REMOTE_FILE_LIST": {
            if (state.phase !== "handshaking") {
                effects.push(log("warn", `Received REMOTE_FILE_LIST in phase=${state.phase}, ignoring`))
                return { state, effects }
            }

            effects.push(log("debug", `Received file list: ${pluralize(event.files.length, "file")}`))

            // During initial file list, detect conflicts between remote snapshot and local files
            effects.push({ type: "DETECT_CONFLICTS", remoteFiles: event.files })

            // Transition to snapshot_processing; conflict detection effect will determine next mode.
            // Note: the remote file list is NOT carried in state — the follow-up CONFLICTS_DETECTED
            // event carries `remoteTotal` so transitions stay purely event-sourced.
            return {
                state: { phase: "snapshot_processing", socket: state.socket },
                effects,
            }
        }

        case "CONFLICTS_DETECTED": {
            if (state.phase !== "snapshot_processing") {
                effects.push(
                    log("warn", `Received CONFLICTS_DETECTED in phase=${state.phase}, ignoring`)
                )
                return { state, effects }
            }

            const { conflicts, safeWrites, localOnly, remoteTotal } = event

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
                    echoPolicy: "authoritative",
                })
            }

            // Upload local-only files
            if (localOnly.length > 0) {
                effects.push(log("debug", `Uploading ${pluralize(localOnly.length, "local-only file")}`))
                for (const file of localOnly) {
                    effects.push({
                        type: "SEND_LOCAL_CHANGE",
                        fileName: file.name,
                        content: file.content,
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
                        phase: "conflict_resolution",
                        socket: state.socket,
                        pendingConflicts: conflicts,
                    },
                    effects,
                }
            }

            // No conflicts → transition to watching. `remoteTotal` is the count the
            // remote sent; `safeWrites` is the subset we actually wrote, so
            // everything else remote-side was already up-to-date locally.
            const totalCount = remoteTotal + localOnly.length
            const updatedCount = safeWrites.length + localOnly.length
            const unchangedCount = Math.max(0, remoteTotal - safeWrites.length)
            effects.push({ type: "PERSIST_STATE" }, { type: "SYNC_COMPLETE", totalCount, updatedCount, unchangedCount })

            return {
                state: { phase: "watching", socket: state.socket },
                effects,
            }
        }

        case "REMOTE_FILE_CHANGE": {
            if (read.isActiveDeletePromptPath?.(event.file.name)) {
                effects.push({
                    type: "INVALIDATE_DELETE_PROMPT_PATH",
                    fileName: event.file.name,
                })
            }

            if (read.isActiveConflictPath?.(event.file.name)) {
                effects.push(log("debug", `Updating active conflict from remote change: ${event.file.name}`), {
                    type: "UPDATE_ACTIVE_CONFLICT_REMOTE",
                    fileName: event.file.name,
                    content: event.file.content,
                    modifiedAt: event.file.modifiedAt,
                })
                return { state, effects }
            }

            if (state.phase === "conflict_resolution") {
                const next = updatePendingConflictRemote(
                    state.pendingConflicts,
                    event.file.name,
                    event.file.content,
                    event.file.modifiedAt
                )
                if (next.changed) {
                    effects.push(log("debug", `Updating pending conflict from remote change: ${event.file.name}`))
                    return {
                        state: { ...state, pendingConflicts: next.conflicts },
                        effects,
                    }
                }
            }

            if (state.phase === "snapshot_processing" || state.phase === "handshaking") {
                effects.push(log("debug", `Ignoring file change during sync: ${event.file.name}`))
                return { state, effects }
            }

            if (state.phase !== "watching" && state.phase !== "conflict_resolution") {
                effects.push(log("warn", `Rejected file change: ${event.file.name} (unknown-file)`))
                return { state, effects }
            }

            // Apply the change
            effects.push(log("debug", `Applying remote change: ${event.file.name}`), {
                type: "WRITE_FILES",
                files: [event.file],
                echoPolicy: "skip-expected-echoes",
            })

            return { state, effects }
        }

        case "REMOTE_FILE_DELETE": {
            if (read.isActiveDeletePromptPath?.(event.fileName)) {
                effects.push({
                    type: "INVALIDATE_DELETE_PROMPT_PATH",
                    fileName: event.fileName,
                })
            }

            if (read.isActiveConflictPath?.(event.fileName)) {
                effects.push(log("debug", `Updating active conflict from remote delete: ${event.fileName}`), {
                    type: "UPDATE_ACTIVE_CONFLICT_REMOTE",
                    fileName: event.fileName,
                    content: null,
                    modifiedAt: Date.now(),
                })
                return { state, effects }
            }

            if (state.phase === "conflict_resolution") {
                const next = updatePendingConflictRemote(state.pendingConflicts, event.fileName, null, Date.now())
                if (next.changed) {
                    effects.push(log("debug", `Updating pending conflict from remote delete: ${event.fileName}`))
                    return {
                        state: { ...state, pendingConflicts: next.conflicts },
                        effects,
                    }
                }
            }

            // Stale queued socket events can arrive after disconnect/reconnect.
            if (state.phase === "disconnected") {
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

        case "DELETE_CONFIRMED": {
            effects.push({
                type: "RESOLVE_DELETE_PROMPT",
                session: event.session,
                confirmedFileNames: event.fileNames,
                cancelledFiles: [],
            })
            return { state, effects }
        }

        case "DELETE_CANCELLED": {
            effects.push({
                type: "RESOLVE_DELETE_PROMPT",
                session: event.session,
                confirmedFileNames: [],
                cancelledFiles: event.files,
            })
            return { state, effects }
        }

        case "CONFLICTS_RESOLVED": {
            effects.push({
                type: "RESOLVE_CONFLICT_PROMPT",
                session: event.session,
                resolution: event.resolution,
                fileNames: event.fileNames,
            })
            return {
                state:
                    state.phase === "disconnected"
                        ? state
                        : { phase: "watching", socket: state.socket },
                effects,
            }
        }

        case "WATCHER_EVENT": {
            // Local file system change detected
            const { kind, relativePath, content } = event.event

            // Only process changes in watching mode
            if (state.phase !== "watching") {
                effects.push(
                    log(
                        "debug",
                        `Ignoring watcher event in phase=${state.phase}: ${kind} ${relativePath}`
                    )
                )
                return { state, effects }
            }

            switch (kind) {
                case "add":
                case "change": {
                    if (content === undefined) {
                        effects.push(log("warn", `Watcher event missing content: ${relativePath}`))
                        return { state, effects }
                    }

                    if (read.isActiveDeletePromptPath?.(relativePath)) {
                        effects.push({
                            type: "INVALIDATE_DELETE_PROMPT_PATH",
                            fileName: relativePath,
                        })
                    }

                    if (read.isActiveConflictPath?.(relativePath)) {
                        effects.push(log("debug", `Updating active conflict from local change: ${relativePath}`), {
                            type: "UPDATE_ACTIVE_CONFLICT_LOCAL",
                            fileName: relativePath,
                            content,
                            modifiedAt: Date.now(),
                        })
                    } else {
                        effects.push({
                            type: "SEND_LOCAL_CHANGE",
                            fileName: relativePath,
                            content,
                        })
                    }
                    break
                }

                case "delete": {
                    if (read.isActiveConflictPath?.(relativePath)) {
                        effects.push(log("debug", `Updating active conflict from local delete: ${relativePath}`), {
                            type: "UPDATE_ACTIVE_CONFLICT_LOCAL",
                            fileName: relativePath,
                            content: null,
                            modifiedAt: Date.now(),
                        })
                    } else {
                        effects.push(log("debug", `Local delete detected: ${relativePath}`), {
                            type: "LOCAL_INITIATED_FILE_DELETE",
                            fileNames: [relativePath],
                        })
                    }
                    break
                }

                case "rename": {
                    if (content === undefined || !event.event.oldRelativePath) {
                        effects.push(log("warn", `Rename event missing data: ${relativePath}`))
                        return { state, effects }
                    }
                    if (
                        read.isActiveConflictPath?.(relativePath) ||
                        read.isActiveConflictPath?.(event.event.oldRelativePath)
                    ) {
                        effects.push(
                            log(
                                "debug",
                                `Ignoring rename touching active conflict: ${event.event.oldRelativePath} -> ${relativePath}`
                            )
                        )
                    } else {
                        effects.push(
                            log("debug", `Local rename detected: ${event.event.oldRelativePath} → ${relativePath}`),
                            {
                                type: "SEND_FILE_RENAME",
                                oldFileName: event.event.oldRelativePath,
                                newFileName: relativePath,
                                content,
                            }
                        )
                    }
                    break
                }
            }

            return { state, effects }
        }

        case "RESOLVE_PENDING_CONFLICTS_WITH_VERSIONS": {
            if (state.phase !== "conflict_resolution") {
                effects.push(
                    log(
                        "warn",
                        `Received RESOLVE_PENDING_CONFLICTS_WITH_VERSIONS in phase=${state.phase}, ignoring`
                    )
                )
                return { state, effects }
            }

            const { autoResolvedLocal, autoResolvedRemote, remainingConflicts } = autoResolveConflicts(
                state.pendingConflicts,
                event.versions
            )

            const localDeleteConflicts: Conflict[] = []
            if (autoResolvedLocal.length > 0) {
                effects.push(log("debug", `Auto-resolved ${autoResolvedLocal.length} local changes`))
                for (const conflict of autoResolvedLocal) {
                    if (conflict.localContent === null) {
                        localDeleteConflicts.push(conflict)
                    } else {
                        effects.push({
                            type: "SEND_LOCAL_CHANGE",
                            fileName: conflict.fileName,
                            content: conflict.localContent,
                        })
                    }
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
                            echoPolicy: "authoritative",
                            silent: true, // Auto-resolved during initial sync - no individual indicators
                        })
                    }
                }
            }

            const conflictsForPrompt =
                remainingConflicts.length > 0 ? [...remainingConflicts, ...localDeleteConflicts] : remainingConflicts

            if (conflictsForPrompt.length > 0) {
                effects.push(log("warn", `${pluralize(conflictsForPrompt.length, "conflict")} require resolution`), {
                    type: "REQUEST_CONFLICT_DECISIONS",
                    conflicts: conflictsForPrompt,
                })

                return {
                    state: { phase: "watching", socket: state.socket },
                    effects,
                }
            }

            if (localDeleteConflicts.length > 0) {
                effects.push({
                    type: "LOCAL_INITIATED_FILE_DELETE",
                    fileNames: localDeleteConflicts.map(conflict => conflict.fileName),
                })
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

            return {
                state: { phase: "watching", socket: state.socket },
                effects,
            }
        }

        default: {
            effects.push(log("warn", `Unhandled event type in transition`))
            return { state, effects }
        }
    }
}

// Apply: the only place that mutates or does I/O

export interface ApplyCtx {
    config: Config
    runtime: SyncRuntime
    syncState: SyncState
    shutdown: () => Promise<void>
}

function emitLog(entry: { level: LogEntryLevel; message: string }): void {
    const logFns: Record<LogEntryLevel, (message: string) => void> = { info, debug, warn, success, status }
    logFns[entry.level](entry.message)
}

function syncCompleteStatusMessage(config: Config): string {
    return config.once ? "Sync complete, exiting..." : "Watching for changes..."
}

function syncCompleteSuccessMessage(
    runtime: SyncRuntime,
    effect: Extract<Effect, { type: "SYNC_COMPLETE" }>
): string | null {
    const relative = runtime.workspace.projectDir ? path.relative(process.cwd(), runtime.workspace.projectDir) : null
    const relativeDirectory = relative != null ? (relative ? "./" + relative : ".") : null
    if (effect.totalCount === 0 && relativeDirectory) {
        return runtime.workspace.projectDirCreated
            ? `Created ${relativeDirectory} folder`
            : `Syncing to ${relativeDirectory} folder`
    }
    if (relativeDirectory && runtime.workspace.projectDirCreated) {
        return `Created ${relativeDirectory} (${pluralize(effect.updatedCount, "file")} added)`
    }
    if (relativeDirectory) {
        return `Synced into ${relativeDirectory} (${pluralize(effect.updatedCount, "file")} updated, ${effect.unchangedCount} unchanged)`
    }
    return `Synced ${pluralize(effect.totalCount, "file")} (${effect.updatedCount} updated, ${effect.unchangedCount} unchanged)`
}

function sendFailureLabel(message: CliToPluginMessage): string {
    return message.type === "file-change" ? message.fileName : message.type
}

async function sendToPlugin(socket: WebSocket | null, message: CliToPluginMessage): Promise<boolean> {
    if (!socket) return false
    try {
        return await sendMessage(socket, message)
    } catch {
        warn(`Failed to push ${sendFailureLabel(message)}`)
        return false
    }
}

async function writeFiles(
    files: Extract<Effect, { type: "WRITE_FILES" }>["files"],
    ctx: ApplyCtx,
    options: { silent?: boolean; echoPolicy: WriteEchoPolicy }
): Promise<void> {
    const { runtime } = ctx
    if (!runtime.workspace.filesDir) return
    const filesToWrite =
        options.echoPolicy === "skip-expected-echoes" ? filterEchoedFiles(files, runtime.memory) : files
    if (options.echoPolicy === "skip-expected-echoes" && filesToWrite.length !== files.length) {
        debug(`Skipped ${pluralize(files.length - filesToWrite.length, "echoed change")}`)
    }
    const results = await writeRemoteFiles(filesToWrite, runtime.workspace.filesDir, runtime.memory)
    for (const result of results) {
        if (!result.ok) continue
        if (!options.silent) fileDown(result.path)
        runtime.memory.recordSyncedContent(result.path, result.file.content, result.file.modifiedAt ?? Date.now())
        runtime.installer?.process(result.path, result.file.content)
    }
}

async function deleteFiles(fileNames: string[], ctx: ApplyCtx): Promise<void> {
    const { runtime } = ctx
    if (!runtime.workspace.filesDir) return
    for (const fileName of fileNames) {
        const result = await deleteLocalFile(fileName, runtime.workspace.filesDir, runtime.memory)
        if (!result.ok) continue
        fileDelete(result.fileName)
        runtime.memory.recordSyncedDelete(result.fileName)
    }
}

async function sendLocalChange(fileName: string, content: string, ctx: ApplyCtx): Promise<void> {
    const { runtime, syncState } = ctx
    const metadata = runtime.metadata.get(fileName)
    if (metadata?.lastSyncedHash === hashFileContent(content)) {
        debug(`Skipping local change for ${fileName}: matches last synced content`)
        return
    }
    if (runtime.memory.matchesContentEcho(fileName, content)) return

    debug(`Local change detected: ${fileName}`)
    const sent = await sendToPlugin(syncState.socket, { type: "file-change", fileName, content })
    if (!sent) return
    runtime.memory.armContentEcho(fileName, content)
    fileUp(fileName)
    runtime.installer?.process(fileName, content)
}

async function sendFileDelete(fileNames: string[], ctx: ApplyCtx): Promise<void> {
    if (fileNames.length === 0) return
    const sent = await sendToPlugin(ctx.syncState.socket, { type: "file-delete", mode: "auto", fileNames })
    if (!sent) return
    for (const fileName of fileNames) ctx.runtime.memory.recordSyncedDelete(fileName)
}

async function sendFileRename(effect: Extract<Effect, { type: "SEND_FILE_RENAME" }>, ctx: ApplyCtx): Promise<void> {
    const { runtime, syncState } = ctx
    const newFileName = normalizeCodeFilePathWithExtension(effect.newFileName)
    const isEcho =
        runtime.memory.matchesContentEcho(newFileName, effect.content) &&
        runtime.memory.matchesExpectedDeleteEcho(effect.oldFileName)
    if (isEcho) {
        debug(`Skipping echoed rename ${effect.oldFileName} -> ${effect.newFileName}`)
        runtime.memory.clearContentEcho(newFileName)
        runtime.memory.clearExpectedDeleteEcho(effect.oldFileName)
        return
    }
    if (!syncState.socket) {
        warn(`No socket available to send rename ${effect.oldFileName} -> ${effect.newFileName}`)
        return
    }
    const sent = await sendToPlugin(syncState.socket, {
        type: "file-rename",
        oldFileName: effect.oldFileName,
        newFileName,
        content: effect.content,
    })
    if (sent) runtime.registerPendingRename(newFileName, { oldFileName: effect.oldFileName, content: effect.content })
}

async function startDeletePrompt(fileNames: string[], ctx: ApplyCtx): Promise<void> {
    const prompt = ctx.runtime.startDeletePrompt(fileNames)
    if (!prompt) return
    const sent = await sendToPlugin(ctx.syncState.socket, {
        type: "file-delete",
        mode: "confirm",
        fileNames: prompt.fileNames,
        session: prompt.session,
    })
    if (!sent) {
        ctx.runtime.clearDeletePromptFiles(prompt.session, prompt.fileNames)
        warn(`Failed to request delete confirmation for ${prompt.fileNames.join(", ")}`)
    }
}

async function startConflictPrompt(
    conflicts: Extract<Effect, { type: "REQUEST_CONFLICT_DECISIONS" }>["conflicts"],
    ctx: ApplyCtx
): Promise<void> {
    const prompt = ctx.runtime.startOrUpdateConflictPrompt(conflicts)
    if (!prompt) return
    const sent = await sendToPlugin(ctx.syncState.socket, {
        type: "conflicts-detected",
        conflicts: prompt.conflicts,
        session: prompt.session,
    })
    if (!sent) {
        ctx.runtime.clearConflictPromptFiles(
            prompt.session,
            prompt.conflicts.map(conflict => conflict.fileName)
        )
        warn("Failed to send conflict prompt")
    }
}

async function applyConflictChange(change: ConflictPromptChange, ctx: ApplyCtx): Promise<void> {
    if (!change.changed) return
    for (const resolved of change.resolved) {
        if (resolved.content === null) ctx.runtime.memory.recordSyncedDelete(resolved.fileName)
        else
            ctx.runtime.memory.recordSyncedContent(
                resolved.fileName,
                resolved.content,
                resolved.modifiedAt ?? Date.now()
            )
    }
    if (ctx.syncState.socket) {
        await sendToPlugin(
            ctx.syncState.socket,
            change.cleared
                ? { type: "conflicts-cleared", session: change.session }
                : { type: "conflicts-detected", conflicts: change.conflicts, session: change.session }
        )
    }
    if (change.resolved.length > 0) await ctx.runtime.metadata.flush()
    if (change.cleared && ctx.runtime.lastEmittedSyncStatus !== "ready") {
        const flushed = await flushPendingSyncComplete(ctx)
        if (flushed !== "empty") return

        await applySyncComplete(
            {
                type: "SYNC_COMPLETE",
                totalCount: change.resolved.length,
                updatedCount: change.resolved.length,
                unchangedCount: 0,
            },
            ctx
        )
    }
}

async function applySyncComplete(effect: Extract<Effect, { type: "SYNC_COMPLETE" }>, ctx: ApplyCtx): Promise<void> {
    const { config, runtime, syncState, shutdown } = ctx
    if (runtime.hasAnyActivePrompt()) {
        runtime.deferSyncComplete({
            totalCount: effect.totalCount,
            updatedCount: effect.updatedCount,
            unchangedCount: effect.unchangedCount,
        })
        debug("Deferring sync completion until active prompts resolve")
        return
    }

    const wasDisconnected = runtime.disconnectUi.wasRecentlyDisconnected()
    let shouldShutdown = !!config.once
    let shouldTryGitInit = false

    if (wasDisconnected) {
        const didShow = runtime.disconnectUi.didShowNotice()
        shouldShutdown = didShow && !!config.once
        if (didShow) {
            success(
                `Reconnected, synced ${pluralize(effect.totalCount, "file")} (${effect.updatedCount} updated, ${effect.unchangedCount} unchanged)`
            )
            status(syncCompleteStatusMessage(config))
        }
    } else {
        const message = syncCompleteSuccessMessage(runtime, effect)
        if (message) success(message)
        status(syncCompleteStatusMessage(config))
        shouldTryGitInit = !!(runtime.workspace.projectDirCreated && runtime.workspace.projectDir)
    }

    await sendToPlugin(syncState.socket, { type: "sync-status", status: "ready" })
    runtime.noteEmittedSyncStatus("ready")
    if (wasDisconnected) runtime.disconnectUi.reset()
    if (shouldTryGitInit && runtime.workspace.projectDir) tryGitInit(runtime.workspace.projectDir)
    if (shouldShutdown) await shutdown()
}

async function flushPendingSyncComplete(ctx: ApplyCtx): Promise<"ready" | "blocked" | "empty"> {
    const result = ctx.runtime.claimPendingSyncComplete()
    if (result.status === "ready") {
        await applySyncComplete({ type: "SYNC_COMPLETE", ...result.payload }, ctx)
    }
    return result.status
}

export async function applyEffect(effect: Effect, ctx: ApplyCtx): Promise<SyncEvent[]> {
    const { config, runtime, syncState } = ctx

    switch (effect.type) {
        case "INIT_WORKSPACE": {
            if (runtime.workspace.projectDir) return []
            const projectName = config.explicitName ?? effect.projectInfo.projectName
            const directoryInfo = await findOrCreateProjectDirectory({
                projectHash: config.projectHash,
                projectName,
                explicitDirectory: config.explicitDirectory,
            })
            runtime.configureWorkspace(directoryInfo.directory, directoryInfo.created)
            if (directoryInfo.nameCollision) warn(`Folder ${projectName} already exists`)
            debug(`Files directory: ${runtime.workspace.filesDir}`)
            await fs.mkdir(runtime.workspace.filesDir!, { recursive: true })
            return []
        }

        case "LOAD_PERSISTED_STATE":
            if (runtime.workspace.projectDir) {
                await runtime.metadata.initialize(runtime.workspace.projectDir)
                debug(`Loaded persisted metadata for ${pluralize(runtime.metadata.size(), "file")}`)
            }
            return []

        case "LIST_LOCAL_FILES":
            if (runtime.workspace.filesDir) {
                await sendToPlugin(syncState.socket, {
                    type: "file-list",
                    files: await listFiles(runtime.workspace.filesDir),
                })
            }
            return []

        case "DETECT_CONFLICTS": {
            if (!runtime.workspace.filesDir) return []
            const { conflicts, writes, localOnly, unchanged } = await detectConflicts(
                effect.remoteFiles,
                runtime.workspace.filesDir,
                { persistedState: runtime.metadata.getPersistedState() }
            )
            for (const file of unchanged) {
                runtime.memory.recordSyncedContent(file.name, file.content, file.modifiedAt ?? Date.now())
            }
            return [
                {
                    type: "CONFLICTS_DETECTED",
                    conflicts,
                    safeWrites: writes,
                    localOnly,
                    remoteTotal: effect.remoteFiles.length,
                },
            ]
        }

        case "SEND_MESSAGE":
            if (effect.payload.type === "file-change")
                await sendLocalChange(effect.payload.fileName, effect.payload.content, ctx)
            else await sendToPlugin(syncState.socket, effect.payload)
            return []

        case "EMIT_SYNC_STATUS":
            await sendToPlugin(syncState.socket, { type: "sync-status", status: effect.status })
            runtime.noteEmittedSyncStatus(effect.status)
            return []

        case "WRITE_FILES":
            await writeFiles(effect.files, ctx, { silent: effect.silent, echoPolicy: effect.echoPolicy })
            return []

        case "DELETE_LOCAL_FILES":
            await deleteFiles(effect.names, ctx)
            return []

        case "REQUEST_CONFLICT_DECISIONS":
            await startConflictPrompt(effect.conflicts, ctx)
            return []

        case "REQUEST_CONFLICT_VERSIONS": {
            if (!syncState.socket) {
                warn("Cannot request conflict versions without active socket")
                return []
            }
            const persistedState = runtime.metadata.getPersistedState()
            const conflicts = effect.conflicts.map(conflict => ({
                fileName: conflict.fileName,
                lastSyncedAt: conflict.lastSyncedAt ?? persistedState.get(conflict.fileName)?.timestamp,
            }))
            debug(`Requesting remote version data for ${pluralize(conflicts.length, "file")}`)
            await sendToPlugin(syncState.socket, { type: "conflict-version-request", conflicts })
            return []
        }

        case "UPDATE_FILE_METADATA": {
            if (!runtime.workspace.filesDir || !runtime.workspace.projectDir) return []
            const currentContent = await readFileSafe(effect.fileName, runtime.workspace.filesDir)
            const pendingRename = runtime.getPendingRename(normalizeCodeFilePathWithExtension(effect.fileName))
            const syncedContent = currentContent ?? pendingRename?.content ?? null
            if (syncedContent !== null)
                runtime.memory.recordSyncedContent(effect.fileName, syncedContent, effect.remoteModifiedAt)
            if (pendingRename) {
                runtime.memory.recordSyncedDelete(pendingRename.oldFileName)
                if (currentContent !== null) runtime.memory.armContentEcho(effect.fileName, currentContent)
                runtime.completePendingRename(effect.fileName)
            }
            return []
        }

        case "SEND_LOCAL_CHANGE":
            await sendLocalChange(effect.fileName, effect.content, ctx)
            return []

        case "SEND_FILE_RENAME":
            await sendFileRename(effect, ctx)
            return []

        case "LOCAL_INITIATED_FILE_DELETE": {
            const filesToDelete: string[] = []
            for (const fileName of effect.fileNames) {
                if (runtime.memory.matchesExpectedDeleteEcho(fileName)) runtime.memory.clearExpectedDeleteEcho(fileName)
                else filesToDelete.push(fileName)
            }
            if (filesToDelete.length === 0) return []
            if (config.dangerouslyAutoDelete) await sendFileDelete(filesToDelete, ctx)
            else await startDeletePrompt(filesToDelete, ctx)
            return []
        }

        case "RESOLVE_DELETE_PROMPT": {
            const activeFileNames = runtime.getDeletePromptFileNames(effect.session, [
                ...effect.confirmedFileNames,
                ...effect.cancelledFiles.map(file => file.fileName),
            ])
            if (!activeFileNames) {
                warn("Ignoring stale delete prompt response (session or paths mismatch)")
                return []
            }
            const active = new Set(activeFileNames)
            const confirmed = effect.confirmedFileNames.filter(fileName =>
                active.has(runtime.memory.normalizePath(fileName))
            )
            const cancelled = effect.cancelledFiles.filter(file =>
                active.has(runtime.memory.normalizePath(file.fileName))
            )
            if (cancelled.length > 0) {
                await writeFiles(
                    cancelled.map(file => ({ name: file.fileName, content: file.content, modifiedAt: Date.now() })),
                    ctx,
                    { echoPolicy: "authoritative" }
                )
            }
            await sendFileDelete(confirmed, ctx)
            runtime.clearDeletePromptFiles(effect.session, activeFileNames)
            await runtime.metadata.flush()
            await flushPendingSyncComplete(ctx)
            return []
        }

        case "RESOLVE_CONFLICT_PROMPT": {
            const conflicts = runtime.getConflictPromptConflicts(effect.session, effect.fileNames)
            if (!conflicts) {
                warn("Ignoring stale conflicts-resolved (session mismatch)")
                return []
            }
            if (effect.resolution === "remote") {
                const filesToWrite: FileInfo[] = []
                const filesToDelete: string[] = []
                for (const conflict of conflicts) {
                    if (conflict.remoteContent === null) {
                        filesToDelete.push(conflict.fileName)
                        continue
                    }
                    filesToWrite.push({
                        name: conflict.fileName,
                        content: conflict.remoteContent,
                        modifiedAt: conflict.remoteModifiedAt,
                    })
                }
                await Promise.all([
                    writeFiles(filesToWrite, ctx, { silent: true, echoPolicy: "authoritative" }),
                    deleteFiles(filesToDelete, ctx),
                ])
            } else {
                for (const conflict of conflicts) {
                    if (conflict.localContent === null) await sendFileDelete([conflict.fileName], ctx)
                    else await sendLocalChange(conflict.fileName, conflict.localContent, ctx)
                }
            }
            success(effect.resolution === "remote" ? "Keeping Framer changes" : "Keeping local changes")
            runtime.clearConflictPromptFiles(effect.session, effect.fileNames)
            await runtime.metadata.flush()
            await applySyncComplete(
                {
                    type: "SYNC_COMPLETE",
                    totalCount: conflicts.length,
                    updatedCount: conflicts.length,
                    unchangedCount: 0,
                },
                ctx
            )
            return []
        }

        case "UPDATE_ACTIVE_CONFLICT_LOCAL":
            await applyConflictChange(
                runtime.updateActiveConflictLocal(effect.fileName, effect.content, effect.modifiedAt),
                ctx
            )
            return []

        case "UPDATE_ACTIVE_CONFLICT_REMOTE":
            await applyConflictChange(
                runtime.updateActiveConflictRemote(effect.fileName, effect.content, effect.modifiedAt),
                ctx
            )
            return []

        case "INVALIDATE_DELETE_PROMPT_PATH": {
            const change = runtime.invalidateDeletePromptPath(effect.fileName)
            if (change.changed) {
                await sendToPlugin(syncState.socket, {
                    type: "delete-prompt-cleared",
                    session: change.session,
                    fileNames: change.fileNames,
                })
                await flushPendingSyncComplete(ctx)
            }
            return []
        }

        case "PERSIST_STATE":
            await runtime.metadata.flush()
            return []

        case "SYNC_COMPLETE":
            await applySyncComplete(effect, ctx)
            return []

        case "LOG":
            emitLog({ level: effect.level, message: effect.message })
            return []
    }
}

/**
 * Starts the sync controller with the given configuration
 */
export async function start(config: Config): Promise<void> {
    const runtime = new SyncRuntime()
    let isShuttingDown = false

    // State machine state
    let syncState: SyncState = {
        phase: "disconnected",
        socket: null,
    }

    const eventQueue = createEventQueue()

    // Top-level ingress (WS, watcher, disconnect) serializes through the queue — one event at a time.
    // Follow-up events from `applyEffect` run inline before the next queued event, so snapshot results
    // can move the controller back to watching before queued remote changes are processed.
    function processEvent(event: SyncEvent): Promise<void> {
        return eventQueue.enqueue(() => processEventInner(event))
    }

    async function processEventInner(event: SyncEvent) {
        const socketState = syncState.socket?.readyState
        debug(
            `[STATE] Processing event: ${event.type} (phase: ${syncState.phase}, socket: ${socketState ?? "none"})`
        )

        const result = transition(syncState, event, {
            wasRecentlyDisconnected: () => runtime.disconnectUi.wasRecentlyDisconnected(),
            isActiveConflictPath: fileName => runtime.isActiveConflictPath(fileName),
            isActiveDeletePromptPath: fileName => runtime.isActiveDeletePromptPath(fileName),
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

            const followUpEvents = await applyEffect(effect, {
                config,
                runtime,
                shutdown,
                syncState,
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
            runtime.disconnectUi.cancelNotice()

            if (syncState.phase !== "disconnected") {
                if (syncState.socket === client) {
                    // Duplicate handshake on the already-active socket.
                    // Route through the state machine instead of imperatively sending,
                    // so EMIT_SYNC_STATUS stays on the normal transition→apply path.
                    const status = runtime.lastEmittedSyncStatus ?? "initial_sync"
                    await processEvent({ type: "RESEND_SYNC_STATUS", status })
                    return
                }
                debug(`New handshake received (phase=${syncState.phase}), resetting sync state`)
                runtime.clearPendingRenames()
                runtime.clearEmittedSyncStatus()
                runtime.cleanupUserActions()
                await processEvent({ type: "DISCONNECT" })
            }

            runtime.mintConnectionId()

            // Only show "Connected" on initial connection, not reconnects
            // Reconnect confirmation happens in SYNC_COMPLETE
            const wasDisconnected = runtime.disconnectUi.wasRecentlyDisconnected()
            if (!wasDisconnected && !runtime.disconnectUi.didShowNotice()) {
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
            if (runtime.workspace.projectDir && !runtime.installer) {
                runtime.installer = new Installer({
                    projectDir: runtime.workspace.projectDir,
                    allowUnsupportedNpm: config.allowUnsupportedNpm,
                })
                await runtime.installer.initialize()
                // Start file watcher now that we have a directory
                startWatcher()
            }
        })()
    })

    // Message Handler
    async function handleMessage(message: PluginToCliMessage) {
        // Ensure project is initialized before handling messages
        if (!runtime.workspace.projectDir || !runtime.installer) {
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
                        // Remote modifiedAt is expensive to compute (requires getVersions API call), so we
                        // use local receipt time. Conflict detection uses content hashes, not timestamps.
                        modifiedAt: Date.now(),
                    },
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
                event = { type: "DELETE_CONFIRMED", session: message.session, fileNames: message.fileNames }
                break
            }

            case "delete-cancelled": {
                event = { type: "DELETE_CANCELLED", session: message.session, files: message.files }
                break
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
                    runtime.completePendingRename(normalizeCodeFilePathWithExtension(message.fileName))
                }
                warn(message.message)
                return

            case "conflicts-resolved": {
                event = {
                    type: "CONFLICTS_RESOLVED",
                    session: message.session,
                    resolution: message.resolution,
                    fileNames: message.fileNames,
                }
                break
            }

            case "conflict-version-response":
                event = {
                    type: "RESOLVE_PENDING_CONFLICTS_WITH_VERSIONS",
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
        runtime.disconnectUi.scheduleNotice(() => {
            status("Disconnected, waiting to reconnect...")
        })
        void (async () => {
            runtime.clearPendingRenames()
            await processEvent({ type: "DISCONNECT" })
            runtime.clearEmittedSyncStatus()
            runtime.cleanupUserActions()
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
        runtime.cleanupUserActions()

        if (watcher) {
            await watcher.close()
            watcher = null
        }

        connection.close()
    }

    const startWatcher = () => {
        if (!runtime.workspace.filesDir || watcher) return
        watcher = initWatcher(runtime.workspace.filesDir)

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
export { transition }
