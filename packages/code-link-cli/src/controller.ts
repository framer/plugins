/**
 * CLI Controller
 *
 * Three-step trace for any sync change. Pick any sync behaviour, you can read
 * the whole story end-to-end in three places:
 *
 *   1. transition(state, event)        — pure next state + Effect[]
 *   2. describeEffect(effect, readCtx) — pure EffectResult (may read disk, never mutates)
 *   3. applyEffectResult(result, ctx)  — fixed pipeline (ONLY place that mutates or does I/O)
 *
 * The describe step's `ctx.runtime` is `ReadonlyRuntime`, so violating step 2's
 * purity invariant is a compile error.
 *
 * Apply pipeline (see EffectResult for field definitions):
 *
 *   1. logs                  — emit each via emitLog
 *   2. pre-send runtime ops  — workspace init, echo cleanup, active conflict
 *                              updates. Send-success mutations stay on send
 *                              intents and never run before a send succeeds.
 *   3. writes                — filterEchoedFiles (if skipEcho) + writeRemoteFiles;
 *                              fileDown unless silent; recordRemoteApplied per file
 *                              via applyRuntimeOp (single-site mutation)
 *   4. deletes               — deleteLocalFile; fileDelete; recordDelete via applyRuntimeOp
 *   5. sends                 — sendMessage each; only successful sends apply
 *                              their onSent runtime ops and installer/fileUp work
 *   6. prompts               — register prompt state, send UI state, return
 *                              immediately; user decisions come back as events
 *   7. post-send runtime ops — recordRemoteApplied, completePendingRename,
 *                              prompt clears, noteEmittedSyncPhase, resetDisconnectState
 *   8. persistState          — runtime.metadata.flush()
 *   9. tryGitInit            — first-sync only, best effort
 *  10. shutdown               — if result.shutdown: await ctx.shutdown()
 *  11. followUps              — returned as SyncEvent[]; runtime enqueues inline
 *                              (parent still holds the queue slot, no re-entry)
 *
 * All state mutation flows through one function (`applyRuntimeOp`). Echo safety is
 * a property of ordering: pre-send runtime ops run before writes/sends; writeRemoteFiles
 * itself arms a SyncMemory echo BEFORE fs.writeFile so inbound hashes are armed
 * before disk events can fire; failed writes/deletes roll those guards back.
 */

import type { PluginToCliMessage } from "@code-link/shared"
import { normalizeCodeFilePathWithExtension, pluralize, shortProjectHash } from "@code-link/shared"
import fs from "fs/promises"
import path from "path"
import type { WebSocket } from "ws"
import type { EffectResult, LogEntry, RuntimeOp } from "./effect-result.ts"
import { createEventQueue } from "./event-queue.ts"
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
import { validateIncomingChange } from "./helpers/sync-validator.ts"
import { initWatcher } from "./helpers/watcher.ts"
import { type ConflictPromptChange, type DeletePromptChange, type ReadonlyRuntime, SyncRuntime } from "./runtime.ts"
import type { Effect, SyncEvent, SyncState } from "./sync-events.ts"
import type { Config } from "./types.ts"
import { debug, error, fileDelete, fileDown, fileUp, info, status, success, warn } from "./utils/logging.ts"
import { findOrCreateProjectDirectory } from "./utils/project.ts"
import { hashFileContent } from "./utils/state-persistence.ts"

export type { ReadonlyRuntime } from "./runtime.ts"
export type { SyncState } from "./sync-events.ts"

/** Log helper */
function log(level: "info" | "debug" | "warn" | "success", message: string): Effect {
    return { type: "LOG", level, message }
}

export interface TransitionRead {
    wasRecentlyDisconnected?: () => boolean
    isActiveConflictPath?: (path: string) => boolean
    isActiveDeletePromptPath?: (path: string) => boolean
}

const PRE_SEND_RUNTIME_OPS: ReadonlySet<RuntimeOp["op"]> = new Set([
    "clearContentEcho",
    "clearDeleteTombstone",
    "initWorkspace",
    "loadPersistedState",
    "invalidateDeletePromptPath",
    "updateActiveConflictLocal",
    "updateActiveConflictRemote",
])

function isPreSendRuntimeOp(op: RuntimeOp): boolean {
    return PRE_SEND_RUNTIME_OPS.has(op.op)
}

/**
 * Pure state transition function
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
                state: { internalPhase: "handshaking", socket: event.socket },
                effects,
            }
        }

        case "RESEND_SYNC_PHASE": {
            // Duplicate handshake from already-active socket — re-announce current phase.
            effects.push(log("debug", `Re-emitting sync-phase=${event.phase} for duplicate handshake`), {
                type: "EMIT_SYNC_PHASE",
                phase: event.phase,
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
                state: { internalPhase: "disconnected", socket: null },
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
            effects.push({ type: "DETECT_CONFLICTS", remoteFiles: event.files })

            // Transition to snapshot_processing; conflict detection effect will determine next mode.
            // Note: the remote file list is NOT carried in state — the follow-up CONFLICTS_DETECTED
            // event carries `remoteTotal` so transitions stay purely event-sourced.
            return {
                state: { internalPhase: "snapshot_processing", socket: state.socket },
                effects,
            }
        }

        case "CONFLICTS_DETECTED": {
            if (state.internalPhase !== "snapshot_processing") {
                effects.push(
                    log("warn", `Received CONFLICTS_DETECTED in internalPhase=${state.internalPhase}, ignoring`)
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
                        internalPhase: "conflict_resolution",
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
                state: { internalPhase: "watching", socket: state.socket },
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
                    state.internalPhase === "disconnected"
                        ? state
                        : { internalPhase: "watching", socket: state.socket },
                effects,
            }
        }

        case "WATCHER_EVENT": {
            // Local file system change detected
            const { kind, relativePath, content } = event.event

            // Only process changes in watching mode
            if (state.internalPhase !== "watching") {
                effects.push(
                    log(
                        "debug",
                        `Ignoring watcher event in internalPhase=${state.internalPhase}: ${kind} ${relativePath}`
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

        case "CONFLICT_VERSION_RESPONSE": {
            if (state.internalPhase !== "conflict_resolution") {
                effects.push(
                    log("warn", `Received CONFLICT_VERSION_RESPONSE in internalPhase=${state.internalPhase}, ignoring`)
                )
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
                    state: { internalPhase: "watching", socket: state.socket },
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

            return {
                state: { internalPhase: "watching", socket: state.socket },
                effects,
            }
        }

        default: {
            effects.push(log("warn", `Unhandled event type in transition`))
            return { state, effects }
        }
    }
}

// ─── describe: pure, may await disk reads, never mutates ────────────────────────

/**
 * Context handed to `describeEffect`.
 *
 * `runtime` is typed `ReadonlyRuntime` — describe is a compile error away from
 * mutating runtime state. Describe may `await` disk reads (listFiles,
 * detectConflicts, readFileSafe), but any mutation must leave via `RuntimeOp[]`
 * in the returned `EffectResult`.
 */
export interface DescribeCtx {
    config: Config
    runtime: ReadonlyRuntime
    syncState: SyncState
}

/**
 * Pure description of SEND_LOCAL_CHANGE. Exported for spec-style tests.
 *
 * Never returns null — a "skip" is still an `EffectResult` (usually just a
 * debug `logs` entry). This keeps `describeEffect` totally declarative.
 */
export function describeSendLocalChange(
    effect: { fileName: string; content: string },
    runtime: ReadonlyRuntime
): EffectResult {
    const contentHash = hashFileContent(effect.content)
    const metadata = runtime.metadata.get(effect.fileName)

    if (metadata?.lastSyncedHash === contentHash) {
        return {
            logs: [
                {
                    level: "debug",
                    message: `Skipping local change for ${effect.fileName}: matches last synced content`,
                },
            ],
        }
    }

    if (runtime.shouldSkipInboundEcho(effect.fileName, effect.content)) {
        return {}
    }

    return {
        logs: [{ level: "debug", message: `Local change detected: ${effect.fileName}` }],
        sends: [
            {
                message: { type: "file-change", fileName: effect.fileName, content: effect.content },
                onSent: [{ op: "recordLocalSend", path: effect.fileName, content: effect.content }],
                fileUp: effect.fileName,
                installerProcess: { fileName: effect.fileName, content: effect.content },
            },
        ],
    }
}

/** Status line emitted at the end of SYNC_COMPLETE (pre-shutdown in once mode). */
function syncCompleteStatusLog(config: Config): LogEntry {
    return config.once
        ? { level: "status", message: "Sync complete, exiting..." }
        : { level: "status", message: "Watching for changes..." }
}

function describeSyncComplete(effect: Extract<Effect, { type: "SYNC_COMPLETE" }>, ctx: DescribeCtx): EffectResult {
    const { runtime, config } = ctx
    const logs: LogEntry[] = []
    const wasDisconnected = runtime.disconnectUi.wasRecentlyDisconnected()

    if (wasDisconnected) {
        const didShow = runtime.disconnectUi.didShowNotice()
        if (didShow) {
            logs.push({
                level: "success",
                message: `Reconnected, synced ${pluralize(effect.totalCount, "file")} (${effect.updatedCount} updated, ${effect.unchangedCount} unchanged)`,
            })
            logs.push(syncCompleteStatusLog(config))
        }
        return {
            logs,
            sends: [{ message: { type: "sync-phase", phase: "ready" } }],
            runtimeOps: [{ op: "noteEmittedSyncPhase", phase: "ready" }, { op: "resetDisconnectState" }],
            // Reconnect without a visible notice stays silent; otherwise honour once.
            shutdown: didShow && !!config.once,
        }
    }

    const relative = runtime.workspace.projectDir ? path.relative(process.cwd(), runtime.workspace.projectDir) : null
    const relativeDirectory = relative != null ? (relative ? "./" + relative : ".") : null

    if (effect.totalCount === 0 && relativeDirectory) {
        logs.push({
            level: "success",
            message: runtime.workspace.projectDirCreated
                ? `Created ${relativeDirectory} folder`
                : `Syncing to ${relativeDirectory} folder`,
        })
    } else if (relativeDirectory && runtime.workspace.projectDirCreated) {
        logs.push({
            level: "success",
            message: `Created ${relativeDirectory} (${pluralize(effect.updatedCount, "file")} added)`,
        })
    } else if (relativeDirectory) {
        logs.push({
            level: "success",
            message: `Synced into ${relativeDirectory} (${pluralize(effect.updatedCount, "file")} updated, ${effect.unchangedCount} unchanged)`,
        })
    } else {
        logs.push({
            level: "success",
            message: `Synced ${pluralize(effect.totalCount, "file")} (${effect.updatedCount} updated, ${effect.unchangedCount} unchanged)`,
        })
    }
    logs.push(syncCompleteStatusLog(config))

    return {
        logs,
        sends: [{ message: { type: "sync-phase", phase: "ready" } }],
        runtimeOps: [{ op: "noteEmittedSyncPhase", phase: "ready" }],
        tryGitInit: !!(runtime.workspace.projectDirCreated && runtime.workspace.projectDir),
        shutdown: !!config.once,
    }
}

/**
 * The pure describe step. Every effect variant returns an `EffectResult` —
 * no mutation, no runtime writes, no logger calls. Disk reads are the only
 * side effect allowed (and only via helpers: listFiles / detectConflicts /
 * readFileSafe).
 *
 * Exported so tests can `toEqual(…)` the returned value without running apply.
 */
export async function describeEffect(effect: Effect, ctx: DescribeCtx): Promise<EffectResult> {
    const { config, runtime, syncState } = ctx
    const fileMetadataCache = runtime.metadata

    switch (effect.type) {
        case "INIT_WORKSPACE": {
            return { runtimeOps: [{ op: "initWorkspace", projectInfo: effect.projectInfo }] }
        }

        case "LOAD_PERSISTED_STATE": {
            return { runtimeOps: [{ op: "loadPersistedState" }] }
        }

        case "LIST_LOCAL_FILES": {
            if (!runtime.workspace.filesDir) return {}
            const files = await listFiles(runtime.workspace.filesDir)
            return { sends: [{ message: { type: "file-list", files } }] }
        }

        case "DETECT_CONFLICTS": {
            if (!runtime.workspace.filesDir) return {}

            const { conflicts, writes, localOnly, unchanged } = await detectConflicts(
                effect.remoteFiles,
                runtime.workspace.filesDir,
                { persistedState: fileMetadataCache.getPersistedState() }
            )

            // Record metadata for unchanged files so late watcher add events get skipped
            // (chokidar ignoreInitial=false fires late adds that would otherwise re-upload).
            const runtimeOps: RuntimeOp[] = unchanged.map(file => ({
                op: "recordRemoteApplied" as const,
                path: file.name,
                content: file.content,
                modifiedAt: file.modifiedAt ?? Date.now(),
            }))

            return {
                runtimeOps,
                followUps: [
                    {
                        type: "CONFLICTS_DETECTED",
                        conflicts,
                        safeWrites: writes,
                        localOnly,
                        remoteTotal: effect.remoteFiles.length,
                    },
                ],
            }
        }

        case "SEND_MESSAGE": {
            if (effect.payload.type === "file-change") {
                return {
                    sends: [
                        {
                            message: effect.payload,
                            onSent: [
                                {
                                    op: "recordLocalSend",
                                    path: effect.payload.fileName,
                                    content: effect.payload.content,
                                },
                            ],
                            fileUp: effect.payload.fileName,
                            installerProcess: { fileName: effect.payload.fileName, content: effect.payload.content },
                        },
                    ],
                }
            }
            return { sends: [{ message: effect.payload }] }
        }

        case "EMIT_SYNC_PHASE": {
            return {
                sends: [{ message: { type: "sync-phase", phase: effect.phase } }],
                runtimeOps: [{ op: "noteEmittedSyncPhase", phase: effect.phase }],
            }
        }

        case "WRITE_FILES": {
            return {
                writes: { files: effect.files, silent: effect.silent, skipEcho: effect.skipEcho },
            }
        }

        case "DELETE_LOCAL_FILES": {
            return { deletes: effect.names }
        }

        case "REQUEST_CONFLICT_DECISIONS": {
            return { prompt: { kind: "conflictDecisions", conflicts: effect.conflicts } }
        }

        case "REQUEST_CONFLICT_VERSIONS": {
            if (!syncState.socket) {
                return {
                    logs: [{ level: "warn", message: "Cannot request conflict versions without active socket" }],
                }
            }
            const persistedState = fileMetadataCache.getPersistedState()
            const versionRequests = effect.conflicts.map(conflict => {
                const persisted = persistedState.get(conflict.fileName)
                return {
                    fileName: conflict.fileName,
                    lastSyncedAt: conflict.lastSyncedAt ?? persisted?.timestamp,
                }
            })
            return {
                logs: [
                    {
                        level: "debug",
                        message: `Requesting remote version data for ${pluralize(versionRequests.length, "file")}`,
                    },
                ],
                sends: [{ message: { type: "conflict-version-request", conflicts: versionRequests } }],
            }
        }

        case "UPDATE_FILE_METADATA": {
            if (!runtime.workspace.filesDir || !runtime.workspace.projectDir) return {}

            const currentContent = await readFileSafe(effect.fileName, runtime.workspace.filesDir)
            const pendingRename = runtime.getPendingRename(normalizeCodeFilePathWithExtension(effect.fileName))
            const syncedContent = currentContent ?? pendingRename?.content ?? null

            const runtimeOps: RuntimeOp[] = []

            if (syncedContent !== null) {
                runtimeOps.push({
                    op: "recordRemoteApplied",
                    path: effect.fileName,
                    content: syncedContent,
                    modifiedAt: effect.remoteModifiedAt,
                })
            }

            if (pendingRename) {
                runtimeOps.push({ op: "recordDelete", path: pendingRename.oldFileName })
                if (currentContent !== null) {
                    runtimeOps.push({ op: "recordLocalSend", path: effect.fileName, content: currentContent })
                }
                runtimeOps.push({ op: "completePendingRename", newPath: effect.fileName })
            }

            return { runtimeOps }
        }

        case "SEND_LOCAL_CHANGE": {
            return describeSendLocalChange(effect, runtime)
        }

        case "SEND_FILE_RENAME": {
            const normalizedNewFileName = normalizeCodeFilePathWithExtension(effect.newFileName)
            const isEchoedRename =
                runtime.shouldSkipInboundEcho(normalizedNewFileName, effect.content) &&
                runtime.shouldSkipDeleteEcho(effect.oldFileName)

            if (isEchoedRename) {
                return {
                    logs: [
                        {
                            level: "debug",
                            message: `Skipping echoed rename ${effect.oldFileName} -> ${effect.newFileName}`,
                        },
                    ],
                    runtimeOps: [
                        { op: "clearContentEcho", path: normalizedNewFileName },
                        { op: "clearDeleteTombstone", path: effect.oldFileName },
                    ],
                }
            }

            if (!syncState.socket) {
                return {
                    logs: [
                        {
                            level: "warn",
                            message: `No socket available to send rename ${effect.oldFileName} -> ${effect.newFileName}`,
                        },
                    ],
                }
            }

            return {
                sends: [
                    {
                        message: {
                            type: "file-rename",
                            oldFileName: effect.oldFileName,
                            newFileName: normalizedNewFileName,
                            content: effect.content,
                        },
                        onSent: [
                            {
                                op: "registerPendingRename",
                                oldPath: effect.oldFileName,
                                newPath: normalizedNewFileName,
                                content: effect.content,
                            },
                        ],
                    },
                ],
            }
        }

        case "LOCAL_INITIATED_FILE_DELETE": {
            const echoed: string[] = []
            const filesToDelete: string[] = []
            for (const fileName of effect.fileNames) {
                if (runtime.shouldSkipDeleteEcho(fileName)) {
                    echoed.push(fileName)
                } else {
                    filesToDelete.push(fileName)
                }
            }

            const runtimeOps: RuntimeOp[] = echoed.map(p => ({ op: "clearDeleteTombstone" as const, path: p }))
            if (filesToDelete.length === 0) {
                return { runtimeOps }
            }

            if (config.dangerouslyAutoDelete) {
                return {
                    runtimeOps,
                    sends: [
                        {
                            message: { type: "file-delete", fileNames: filesToDelete },
                            onSent: filesToDelete.map(path => ({ op: "recordDelete" as const, path })),
                        },
                    ],
                }
            }

            return {
                runtimeOps,
                prompt: {
                    kind: "deleteConfirmation",
                    fileNames: filesToDelete,
                    requireConfirmation: true,
                },
            }
        }

        case "RESOLVE_DELETE_PROMPT": {
            const activeFileNames = runtime.getDeletePromptFileNames(effect.session, [
                ...effect.confirmedFileNames,
                ...effect.cancelledFiles.map(file => file.fileName),
            ])
            if (!activeFileNames) {
                return {
                    logs: [
                        { level: "warn", message: "Ignoring stale delete prompt response (session or paths mismatch)" },
                    ],
                }
            }

            const activeFileNameSet = new Set(activeFileNames)
            const confirmedFileNames = effect.confirmedFileNames.filter(fileName =>
                activeFileNameSet.has(runtime.normalizePath(fileName))
            )
            const cancelledFiles = effect.cancelledFiles.filter(file =>
                activeFileNameSet.has(runtime.normalizePath(file.fileName))
            )
            const writes =
                cancelledFiles.length > 0
                    ? {
                          files: cancelledFiles.map(file => ({
                              name: file.fileName,
                              content: file.content,
                              modifiedAt: Date.now(),
                          })),
                      }
                    : undefined

            return {
                writes,
                sends:
                    confirmedFileNames.length > 0
                        ? [
                              {
                                  message: { type: "file-delete", fileNames: confirmedFileNames },
                                  onSent: confirmedFileNames.map(path => ({
                                      op: "recordDelete" as const,
                                      path,
                                  })),
                              },
                          ]
                        : undefined,
                runtimeOps: [
                    {
                        op: "clearDeletePromptFiles",
                        session: effect.session,
                        fileNames: activeFileNames,
                    },
                ],
                persistState: true,
            }
        }

        case "RESOLVE_CONFLICT_PROMPT": {
            const conflicts = runtime.getConflictPromptConflicts(effect.session, effect.fileNames)
            if (!conflicts) {
                return {
                    logs: [{ level: "warn", message: "Ignoring stale conflicts-resolved (session mismatch)" }],
                }
            }

            const writes: { name: string; content: string; modifiedAt?: number }[] = []
            const deletes: string[] = []
            const sends: NonNullable<EffectResult["sends"]> = []

            for (const conflict of conflicts) {
                if (effect.resolution === "remote") {
                    if (conflict.remoteContent === null) {
                        deletes.push(conflict.fileName)
                    } else {
                        writes.push({
                            name: conflict.fileName,
                            content: conflict.remoteContent,
                            modifiedAt: conflict.remoteModifiedAt,
                        })
                    }
                    continue
                }

                if (conflict.localContent === null) {
                    sends.push({
                        message: { type: "file-delete" as const, fileNames: [conflict.fileName] },
                        onSent: [{ op: "recordDelete" as const, path: conflict.fileName }],
                    })
                } else {
                    sends.push({
                        message: {
                            type: "file-change" as const,
                            fileName: conflict.fileName,
                            content: conflict.localContent,
                        },
                        onSent: [
                            { op: "recordLocalSend" as const, path: conflict.fileName, content: conflict.localContent },
                        ],
                        fileUp: conflict.fileName,
                        installerProcess: { fileName: conflict.fileName, content: conflict.localContent },
                    })
                }
            }

            const complete = describeSyncComplete(
                {
                    type: "SYNC_COMPLETE",
                    totalCount: conflicts.length,
                    updatedCount: conflicts.length,
                    unchangedCount: 0,
                },
                ctx
            )

            return {
                logs: [
                    {
                        level: "success",
                        message: effect.resolution === "remote" ? "Keeping Framer changes" : "Keeping local changes",
                    },
                    ...(complete.logs ?? []),
                ],
                writes: writes.length > 0 ? { files: writes, silent: true } : undefined,
                deletes: deletes.length > 0 ? deletes : undefined,
                sends: [...sends, ...(complete.sends ?? [])],
                runtimeOps: [
                    { op: "clearConflictPromptFiles", session: effect.session, fileNames: effect.fileNames },
                    ...(complete.runtimeOps ?? []),
                ],
                persistState: true,
                tryGitInit: complete.tryGitInit,
                shutdown: complete.shutdown,
            }
        }

        case "UPDATE_ACTIVE_CONFLICT_LOCAL": {
            return {
                runtimeOps: [
                    {
                        op: "updateActiveConflictLocal",
                        path: effect.fileName,
                        content: effect.content,
                        modifiedAt: effect.modifiedAt,
                    },
                ],
                refreshConflictPrompt: true,
                persistState: true,
            }
        }

        case "UPDATE_ACTIVE_CONFLICT_REMOTE": {
            return {
                runtimeOps: [
                    {
                        op: "updateActiveConflictRemote",
                        path: effect.fileName,
                        content: effect.content,
                        modifiedAt: effect.modifiedAt,
                    },
                ],
                refreshConflictPrompt: true,
                persistState: true,
            }
        }

        case "INVALIDATE_DELETE_PROMPT_PATH": {
            return {
                runtimeOps: [{ op: "invalidateDeletePromptPath", path: effect.fileName }],
                refreshDeletePrompt: true,
            }
        }

        case "PERSIST_STATE": {
            return { persistState: true }
        }

        case "SYNC_COMPLETE": {
            return describeSyncComplete(effect, ctx)
        }

        case "LOG": {
            return { logs: [{ level: effect.level, message: effect.message }] }
        }
    }
}

// ─── apply: fixed pipeline — the only place that mutates or does I/O ────────────

/**
 * Dispatch a log entry to the matching logger.
 *
 * Every mutation outside runtime state (printing) flows through here so that
 * describe can stay pure and tests can assert `logs: […]` on the returned
 * `EffectResult`.
 */
function emitLog(entry: LogEntry): void {
    const logFns: Record<LogEntry["level"], (m: string) => void> = {
        info,
        warn,
        success,
        debug,
        status,
    }
    logFns[entry.level](entry.message)
}

interface RuntimeOpOutcome {
    op: RuntimeOp["op"]
    conflictPromptChange?: ConflictPromptChange
    deletePromptChange?: DeletePromptChange
}

interface RuntimeOpsOutcome {
    outcomes: RuntimeOpOutcome[]
}

interface WriteFilesOutcome {
    attempted: number
    written: number
    skippedEchoes: number
}

interface DeleteFilesOutcome {
    attempted: number
    deleted: number
}

interface SendMessagesOutcome {
    attempted: number
    sent: number
    runtime: RuntimeOpsOutcome
}

interface PromptOutcome {
    attempted: boolean
    sent: boolean
}

interface PromptRefreshOutcome {
    conflictRefreshed: boolean
    deleteRefreshed: boolean
}

type ChangedConflictPromptChange = Extract<ConflictPromptChange, { changed: true }>
type ChangedDeletePromptChange = Extract<DeletePromptChange, { changed: true }>

/**
 * The ONE place that mutates `SyncRuntime`, its embedded caches, or `config`.
 * Every mutation in `applyEffectResult` flows through here; grep for
 * `applyRuntimeOp(` to audit state-change paths.
 *
 * Async because two ops (initWorkspace, loadPersistedState) do disk I/O. Callers
 * always `await`.
 */
async function applyRuntimeOp(op: RuntimeOp, runtime: SyncRuntime, config: Config): Promise<RuntimeOpOutcome> {
    const outcome = (): RuntimeOpOutcome => ({ op: op.op })
    switch (op.op) {
        case "recordLocalSend":
            runtime.armContentEcho(op.path, op.content)
            return outcome()
        case "recordRemoteApplied":
            runtime.recordSyncedContent(op.path, op.content, op.modifiedAt)
            return outcome()
        case "recordDelete":
            runtime.recordSyncedDelete(op.path)
            return outcome()
        case "registerPendingRename":
            runtime.registerPendingRename(op.newPath, { oldFileName: op.oldPath, content: op.content })
            return outcome()
        case "completePendingRename":
            runtime.completePendingRename(normalizeCodeFilePathWithExtension(op.newPath))
            return outcome()
        case "clearContentEcho":
            runtime.clearContentEcho(op.path)
            return outcome()
        case "clearDeleteTombstone":
            runtime.clearDeleteTombstone(op.path)
            return outcome()
        case "initWorkspace": {
            // First HANDSHAKE: resolve / create the project directory, stash the
            // absolute paths on runtime.workspace, and mkdir the files subdir.
            if (runtime.workspace.projectDir) return outcome()
            const projectName = config.explicitName ?? op.projectInfo.projectName
            const directoryInfo = await findOrCreateProjectDirectory({
                projectHash: config.projectHash,
                projectName,
                explicitDirectory: config.explicitDirectory,
            })
            runtime.configureWorkspace(directoryInfo.directory, directoryInfo.created)
            if (directoryInfo.nameCollision) warn(`Folder ${projectName} already exists`)
            debug(`Files directory: ${runtime.workspace.filesDir}`)
            await fs.mkdir(runtime.workspace.filesDir!, { recursive: true })
            return outcome()
        }
        case "loadPersistedState": {
            if (!runtime.workspace.projectDir) return outcome()
            await runtime.metadata.initialize(runtime.workspace.projectDir)
            debug(`Loaded persisted metadata for ${pluralize(runtime.metadata.size(), "file")}`)
            return outcome()
        }
        case "noteEmittedSyncPhase":
            runtime.noteEmittedSyncPhase(op.phase)
            return outcome()
        case "resetDisconnectState":
            runtime.disconnectUi.reset()
            return outcome()
        case "clearDeletePromptFiles":
            if (!runtime.clearDeletePromptFiles(op.session, op.fileNames)) {
                warn("Ignoring stale delete prompt cleanup (session mismatch)")
            }
            return outcome()
        case "clearConflictPromptFiles":
            if (!runtime.clearConflictPromptFiles(op.session, op.fileNames)) {
                warn("Ignoring stale conflict prompt cleanup (session mismatch)")
            }
            return outcome()
        case "invalidateDeletePromptPath":
            return { op: op.op, deletePromptChange: runtime.invalidateDeletePromptPath(op.path) }
        case "updateActiveConflictLocal":
            return {
                op: op.op,
                conflictPromptChange: runtime.updateActiveConflictLocal(op.path, op.content, op.modifiedAt),
            }
        case "updateActiveConflictRemote":
            return {
                op: op.op,
                conflictPromptChange: runtime.updateActiveConflictRemote(op.path, op.content, op.modifiedAt),
            }
    }
}

async function applyRuntimeOps(
    ops: RuntimeOp[],
    timing: "pre-send" | "post-send",
    runtime: SyncRuntime,
    config: Config
): Promise<RuntimeOpsOutcome> {
    const outcomes: RuntimeOpOutcome[] = []
    for (const op of ops) {
        if (timing === "pre-send" && !isPreSendRuntimeOp(op)) continue
        if (timing === "post-send" && isPreSendRuntimeOp(op)) continue
        const outcome = await applyRuntimeOp(op, runtime, config)
        outcomes.push(outcome, ...(await applyResolvedConflictCommits(outcome, runtime, config)))
    }
    return { outcomes }
}

async function applyResolvedConflictCommits(
    outcome: RuntimeOpOutcome,
    runtime: SyncRuntime,
    config: Config
): Promise<RuntimeOpOutcome[]> {
    const change = outcome.conflictPromptChange
    if (!change?.changed || change.resolved.length === 0) return []

    const outcomes: RuntimeOpOutcome[] = []
    for (const resolved of change.resolved) {
        if (resolved.content === null) {
            outcomes.push(await applyRuntimeOp({ op: "recordDelete", path: resolved.fileName }, runtime, config))
            continue
        }
        outcomes.push(
            await applyRuntimeOp(
                {
                    op: "recordRemoteApplied",
                    path: resolved.fileName,
                    content: resolved.content,
                    modifiedAt: resolved.modifiedAt ?? Date.now(),
                },
                runtime,
                config
            )
        )
    }
    return outcomes
}

async function applyWrites(result: EffectResult, runtime: SyncRuntime, config: Config): Promise<WriteFilesOutcome> {
    if (!result.writes?.files || !runtime.workspace.filesDir) {
        return { attempted: 0, written: 0, skippedEchoes: 0 }
    }

    const operationMemory = runtime.fileOperations()
    const filesToWrite =
        result.writes.skipEcho === true ? filterEchoedFiles(result.writes.files, operationMemory) : result.writes.files
    const skippedEchoes = result.writes.files.length - filesToWrite.length

    if (result.writes.skipEcho && skippedEchoes > 0) {
        debug(`Skipped ${pluralize(skippedEchoes, "echoed change")}`)
    }

    if (filesToWrite.length === 0) {
        return { attempted: result.writes.files.length, written: 0, skippedEchoes }
    }

    const writeResults = await writeRemoteFiles(filesToWrite, runtime.workspace.filesDir, operationMemory)
    let written = 0
    for (const outcome of writeResults) {
        if (!outcome.ok) continue
        written += 1
        if (!result.writes.silent) fileDown(outcome.path)
        await applyRuntimeOp(
            {
                op: "recordRemoteApplied",
                path: outcome.path,
                content: outcome.file.content,
                modifiedAt: outcome.file.modifiedAt ?? Date.now(),
            },
            runtime,
            config
        )
        runtime.installer?.process(outcome.path, outcome.file.content)
    }

    return { attempted: result.writes.files.length, written, skippedEchoes }
}

async function applyDeletes(result: EffectResult, runtime: SyncRuntime, config: Config): Promise<DeleteFilesOutcome> {
    if (!result.deletes || !runtime.workspace.filesDir) {
        return { attempted: 0, deleted: 0 }
    }

    let deleted = 0
    for (const fileName of result.deletes) {
        const outcome = await deleteLocalFile(fileName, runtime.workspace.filesDir, runtime.fileOperations())
        if (!outcome.ok) continue
        deleted += 1
        fileDelete(outcome.fileName)
        await applyRuntimeOp({ op: "recordDelete", path: outcome.fileName }, runtime, config)
    }
    return { attempted: result.deletes.length, deleted }
}

async function applySends(result: EffectResult, ctx: ApplyCtx): Promise<SendMessagesOutcome> {
    const { runtime, config, syncState } = ctx
    const runtimeOutcomes: RuntimeOpOutcome[] = []
    if (!result.sends || !syncState.socket) {
        return { attempted: 0, sent: 0, runtime: { outcomes: runtimeOutcomes } }
    }

    let sentCount = 0
    for (const intent of result.sends) {
        try {
            const sent = await sendMessage(syncState.socket, intent.message)
            if (!sent) continue
            sentCount += 1
            if (intent.onSent) {
                for (const op of intent.onSent) {
                    runtimeOutcomes.push(await applyRuntimeOp(op, runtime, config))
                }
            }
            if (intent.fileUp) fileUp(intent.fileUp)
            if (intent.installerProcess) {
                runtime.installer?.process(intent.installerProcess.fileName, intent.installerProcess.content)
            }
        } catch {
            const label = intent.message.type === "file-change" ? intent.message.fileName : intent.message.type
            warn(`Failed to push ${label}`)
        }
    }

    return { attempted: result.sends.length, sent: sentCount, runtime: { outcomes: runtimeOutcomes } }
}

async function applyPrompt(result: EffectResult, ctx: ApplyCtx): Promise<PromptOutcome> {
    const { runtime, syncState } = ctx
    if (!result.prompt || !syncState.socket) return { attempted: false, sent: false }

    if (result.prompt.kind === "deleteConfirmation") {
        const prompt = runtime.startDeletePrompt(result.prompt.fileNames)
        if (!prompt) return { attempted: true, sent: false }
        const sent = await sendMessage(syncState.socket, {
            type: "file-delete",
            fileNames: prompt.fileNames,
            requireConfirmation: true,
            session: prompt.session,
        })
        if (!sent) {
            runtime.clearDeletePromptFiles(prompt.session, prompt.fileNames)
            warn(`Failed to request delete confirmation for ${prompt.fileNames.join(", ")}`)
        }
        return { attempted: true, sent }
    }

    const prompt = runtime.startOrUpdateConflictPrompt(result.prompt.conflicts)
    if (!prompt) return { attempted: true, sent: false }
    const sent = await sendMessage(syncState.socket, {
        type: "conflicts-detected",
        conflicts: prompt.conflicts,
        session: prompt.session,
    })
    if (!sent) {
        runtime.clearConflictPromptFiles(
            prompt.session,
            prompt.conflicts.map(conflict => conflict.fileName)
        )
        warn("Failed to send conflict prompt")
    }
    return { attempted: true, sent }
}

function latestConflictPromptChange(outcomes: RuntimeOpOutcome[]): ChangedConflictPromptChange | null {
    for (let index = outcomes.length - 1; index >= 0; index -= 1) {
        const change = outcomes[index]?.conflictPromptChange
        if (change?.changed) return change
    }
    return null
}

function latestDeletePromptChange(outcomes: RuntimeOpOutcome[]): ChangedDeletePromptChange | null {
    for (let index = outcomes.length - 1; index >= 0; index -= 1) {
        const change = outcomes[index]?.deletePromptChange
        if (change?.changed) return change
    }
    return null
}

async function refreshPromptUi(
    result: EffectResult,
    runtime: SyncRuntime,
    socket: WebSocket | null,
    runtimeOutcomes: RuntimeOpOutcome[]
): Promise<PromptRefreshOutcome> {
    let conflictRefreshed = false
    let deleteRefreshed = false

    if (result.refreshConflictPrompt && socket) {
        const change = latestConflictPromptChange(runtimeOutcomes)
        if (change) {
            conflictRefreshed = true
            if (change.cleared) {
                await sendMessage(socket, { type: "conflicts-cleared", session: change.session })
            } else {
                await sendMessage(socket, {
                    type: "conflicts-detected",
                    conflicts: change.conflicts,
                    session: change.session,
                })
            }
        } else {
            const prompt = runtime.getActiveConflictPrompt()
            if (prompt) {
                conflictRefreshed = true
                await sendMessage(socket, {
                    type: "conflicts-detected",
                    conflicts: prompt.conflicts,
                    session: prompt.session,
                })
            }
        }
    }

    if (result.refreshDeletePrompt && socket) {
        const change = latestDeletePromptChange(runtimeOutcomes)
        if (change) {
            deleteRefreshed = true
            await sendMessage(socket, {
                type: "delete-prompt-cleared",
                session: change.session,
                fileNames: change.fileNames,
            })
        }
    }

    return { conflictRefreshed, deleteRefreshed }
}

async function persistAndFinalize(result: EffectResult, ctx: ApplyCtx): Promise<void> {
    const { runtime, shutdown } = ctx
    if (result.persistState) await runtime.metadata.flush()
    if (result.tryGitInit && runtime.workspace.projectDir) {
        tryGitInit(runtime.workspace.projectDir)
    }
    if (result.shutdown) {
        await shutdown()
    }
}

export interface ApplyCtx {
    config: Config
    runtime: SyncRuntime
    syncState: SyncState
    shutdown: () => Promise<void>
}

/**
 * The fixed pipeline. See EffectResult's file comment for the step numbers.
 * Returns follow-up SyncEvents the runtime should enqueue inline.
 */
export async function applyEffectResult(result: EffectResult, ctx: ApplyCtx): Promise<SyncEvent[]> {
    const { runtime, config, syncState } = ctx

    // 1. logs
    if (result.logs) for (const entry of result.logs) emitLog(entry)

    const ops = result.runtimeOps ?? []
    // 2-6. Each step returns a typed outcome so race-sensitive follow-up work is explicit.
    const preRuntime = await applyRuntimeOps(ops, "pre-send", runtime, config)
    await applyWrites(result, runtime, config)
    await applyDeletes(result, runtime, config)
    const sendOutcome = await applySends(result, ctx)
    await applyPrompt(result, ctx)
    await refreshPromptUi(result, runtime, syncState.socket, [...preRuntime.outcomes, ...sendOutcome.runtime.outcomes])

    // 7. post-send runtime ops
    await applyRuntimeOps(ops, "post-send", runtime, config)

    // 8-10. Persist, git init, and shutdown are intentionally boring and last.
    await persistAndFinalize(result, ctx)

    return result.followUps ?? []
}

/**
 * Thin wrapper: describe (pure, may read) → apply (fixed pipeline).
 */
async function executeEffect(effect: Effect, ctx: ApplyCtx): Promise<SyncEvent[]> {
    const described = await describeEffect(effect, ctx)
    return applyEffectResult(described, ctx)
}

/**
 * Starts the sync controller with the given configuration
 */
export async function start(config: Config): Promise<void> {
    const runtime = new SyncRuntime()
    let isShuttingDown = false

    // State machine state
    let syncState: SyncState = {
        internalPhase: "disconnected",
        socket: null,
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

            const followUpEvents = await executeEffect(effect, {
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

            if (syncState.internalPhase !== "disconnected") {
                if (syncState.socket === client) {
                    // Duplicate handshake on the already-active socket.
                    // Route through the state machine instead of imperatively sending,
                    // so EMIT_SYNC_PHASE (runtimeOp `noteEmittedSyncPhase` + send) flows
                    // through the normal describe→apply pipeline.
                    const phase = runtime.lastEmittedSyncPhase ?? "initial_sync"
                    await processEvent({ type: "RESEND_SYNC_PHASE", phase })
                    return
                }
                debug(`New handshake received (internalPhase=${syncState.internalPhase}), resetting sync state`)
                runtime.clearPendingRenames()
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
                        // Remote modifiedAt is expensive to compute (requires getVerions API call), so we
                        // use local receipt time. Conflict detection uses content hashes, not timestamps.
                        modifiedAt: Date.now(),
                    },
                    fileMeta: runtime.metadata.get(message.fileName),
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
        runtime.disconnectUi.scheduleNotice(() => {
            status("Disconnected, waiting to reconnect...")
        })
        void (async () => {
            runtime.clearPendingRenames()
            await processEvent({ type: "DISCONNECT" })
            runtime.clearEmittedSyncPhase()
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
export { executeEffect, transition }
