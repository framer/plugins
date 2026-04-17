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
 *   2. pre-send runtime ops  — recordLocalSend, registerPendingRename, recordDelete,
 *                              forgetPath, clearDeleteTombstone, initWorkspace,
 *                              loadPersistedState. `applyRuntimeOp` is async and
 *                              handles every variant (the two disk-touching ones
 *                              inline), so this step is a simple `for … await`.
 *   3. writes                — filterEchoedFiles (if skipEcho) + writeRemoteFiles;
 *                              fileDown unless silent; recordRemoteApplied per file
 *                              via applyRuntimeOp (single-site mutation)
 *   4. deletes               — deleteLocalFile; fileDelete; recordDelete via applyRuntimeOp
 *   5. sends                 — sendMessage each; on any successful file-change:
 *                              fileUp + installer.process
 *   6. awaitPrompt           — runtime.request{Delete,Conflict}Decisions; confirmed
 *                              deletes flow back through recordDelete runtimeOp
 *   7. post-send runtime ops — recordRemoteApplied, completePendingRename,
 *                              noteEmittedSyncPhase, resetDisconnectState
 *   8. persistState          — runtime.metadata.flush()
 *   9. tryGitInit            — first-sync only, best effort
 *  10. shutdown               — if result.shutdown: await ctx.shutdown()
 *  11. followUps              — returned as SyncEvent[]; runtime enqueues inline
 *                              (parent still holds the queue slot, no re-entry)
 *
 * All state mutation flows through one function (`applyRuntimeOp`). Echo safety is
 * a property of ordering: pre-send runtime ops run before writes/sends; writeRemoteFiles
 * itself calls memory.rememberRemoteWrite BEFORE fs.writeFile so inbound hashes are
 * armed before disk events can fire.
 */

import type { PluginToCliMessage } from "@code-link/shared"
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
import { SyncRuntime, type ReadonlyRuntime } from "./runtime.ts"
import { validateIncomingChange } from "./helpers/sync-validator.ts"
import { initWatcher } from "./helpers/watcher.ts"
import type { Config } from "./types.ts"
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
import type { EffectResult, RuntimeOp, LogEntry } from "./effect-result.ts"
import { createEventQueue } from "./event-queue.ts"
import { findOrCreateProjectDirectory } from "./utils/project.ts"
import { hashFileContent } from "./utils/state-persistence.ts"
import type { Effect, SyncEvent, SyncState } from "./sync-events.ts"
export type { SyncState } from "./sync-events.ts"
export type { ReadonlyRuntime } from "./runtime.ts"

/** Log helper */
function log(level: "info" | "debug" | "warn" | "success", message: string): Effect {
    return { type: "LOG", level, message }
}

export interface TransitionRead {
    wasRecentlyDisconnected?: () => boolean
}

const PRE_SEND_RUNTIME_OPS: ReadonlySet<RuntimeOp["op"]> = new Set([
    "recordLocalSend",
    "registerPendingRename",
    "recordDelete",
    "forgetPath",
    "clearDeleteTombstone",
    "initWorkspace",
    "loadPersistedState",
])

function isPreSendRuntimeOp(op: RuntimeOp): boolean {
    return PRE_SEND_RUNTIME_OPS.has(op.op)
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
                state: { internalPhase: "handshaking", socket: event.socket },
                effects,
            }
        }

        case "RESEND_SYNC_PHASE": {
            // Duplicate handshake from already-active socket — re-announce current phase.
            effects.push(
                log("debug", `Re-emitting sync-phase=${event.phase} for duplicate handshake`),
                { type: "EMIT_SYNC_PHASE", phase: event.phase }
            )
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
                effects.push(log("warn", `Received CONFLICTS_DETECTED in internalPhase=${state.internalPhase}, ignoring`))
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
            effects.push(
                { type: "PERSIST_STATE" },
                { type: "SYNC_COMPLETE", totalCount, updatedCount, unchangedCount }
            )

            return {
                state: { internalPhase: "watching", socket: state.socket },
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

            return {
                state: { internalPhase: "watching", socket: state.socket },
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
        runtimeOps: [{ op: "recordLocalSend", path: effect.fileName, content: effect.content }],
        sends: [{ type: "file-change", fileName: effect.fileName, content: effect.content }],
        fileUp: effect.fileName,
        installerProcess: { fileName: effect.fileName, content: effect.content },
    }
}

/** Status line emitted at the end of SYNC_COMPLETE (pre-shutdown in once mode). */
function syncCompleteStatusLog(config: Config): LogEntry {
    return config.once
        ? { level: "status", message: "Sync complete, exiting..." }
        : { level: "status", message: "Watching for changes..." }
}

function describeSyncComplete(
    effect: Extract<Effect, { type: "SYNC_COMPLETE" }>,
    ctx: DescribeCtx
): EffectResult {
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
            sends: [{ type: "sync-phase", phase: "ready" }],
            runtimeOps: [{ op: "noteEmittedSyncPhase", phase: "ready" }, { op: "resetDisconnectState" }],
            // Reconnect without a visible notice stays silent; otherwise honour once.
            shutdown: didShow && !!config.once,
        }
    }

    const relative = config.projectDir ? path.relative(process.cwd(), config.projectDir) : null
    const relativeDirectory = relative != null ? (relative ? "./" + relative : ".") : null

    if (effect.totalCount === 0 && relativeDirectory) {
        logs.push({
            level: "success",
            message: config.projectDirCreated
                ? `Created ${relativeDirectory} folder`
                : `Syncing to ${relativeDirectory} folder`,
        })
    } else if (relativeDirectory && config.projectDirCreated) {
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
        sends: [{ type: "sync-phase", phase: "ready" }],
        runtimeOps: [{ op: "noteEmittedSyncPhase", phase: "ready" }],
        tryGitInit: !!(config.projectDirCreated && config.projectDir),
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
            if (!config.filesDir) return {}
            const files = await listFiles(config.filesDir)
            return { sends: [{ type: "file-list", files }] }
        }

        case "DETECT_CONFLICTS": {
            if (!config.filesDir) return {}

            const { conflicts, writes, localOnly, unchanged } = await detectConflicts(
                effect.remoteFiles,
                config.filesDir,
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
            return { sends: [effect.payload] }
        }

        case "EMIT_SYNC_PHASE": {
            return {
                sends: [{ type: "sync-phase", phase: effect.phase }],
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
            return { awaitPrompt: { kind: "conflictDecisions", conflicts: effect.conflicts } }
        }

        case "REQUEST_CONFLICT_VERSIONS": {
            if (!syncState.socket) {
                return {
                    logs: [
                        { level: "warn", message: "Cannot request conflict versions without active socket" },
                    ],
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
                sends: [{ type: "conflict-version-request", conflicts: versionRequests }],
            }
        }

        case "UPDATE_FILE_METADATA": {
            if (!config.filesDir || !config.projectDir) return {}

            const currentContent = await readFileSafe(effect.fileName, config.filesDir)
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
                        { op: "forgetPath", path: normalizedNewFileName },
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
                        type: "file-rename",
                        oldFileName: effect.oldFileName,
                        newFileName: normalizedNewFileName,
                        content: effect.content,
                    },
                ],
                runtimeOps: [
                    {
                        op: "registerPendingRename",
                        oldPath: effect.oldFileName,
                        newPath: normalizedNewFileName,
                        content: effect.content,
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

            return {
                runtimeOps,
                awaitPrompt: {
                    kind: "deleteConfirmation",
                    fileNames: filesToDelete,
                    requireConfirmation: !config.dangerouslyAutoDelete,
                },
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

/**
 * The ONE place that mutates `SyncRuntime`, its embedded caches, or `config`.
 * Every mutation in `applyEffectResult` flows through here; grep for
 * `applyRuntimeOp(` to audit state-change paths.
 *
 * Async because two ops (initWorkspace, loadPersistedState) do disk I/O. Callers
 * always `await`.
 */
async function applyRuntimeOp(op: RuntimeOp, runtime: SyncRuntime, config: Config): Promise<void> {
    const fileMetadataCache = runtime.metadata
    switch (op.op) {
        case "recordLocalSend":
            runtime.rememberLocalSend(op.path, op.content)
            return
        case "recordRemoteApplied":
            fileMetadataCache.recordSyncedSnapshot(op.path, hashFileContent(op.content), op.modifiedAt)
            return
        case "recordDelete":
            runtime.forgetPath(op.path)
            fileMetadataCache.recordDelete(op.path)
            return
        case "registerPendingRename":
            runtime.setPendingRename(op.newPath, { oldFileName: op.oldPath, content: op.content })
            return
        case "completePendingRename":
            runtime.deletePendingRename(normalizeCodeFilePathWithExtension(op.newPath))
            return
        case "forgetPath":
            runtime.forgetPath(op.path)
            return
        case "clearDeleteTombstone":
            runtime.clearDeleteTombstone(op.path)
            return
        case "initWorkspace": {
            // First HANDSHAKE: resolve / create the project directory, stash the
            // absolute paths on `config`, and mkdir the files subdir.
            if (config.projectDir) return
            const projectName = config.explicitName ?? op.projectInfo.projectName
            const directoryInfo = await findOrCreateProjectDirectory({
                projectHash: config.projectHash,
                projectName,
                explicitDirectory: config.explicitDirectory,
            })
            config.projectDir = directoryInfo.directory
            config.projectDirCreated = directoryInfo.created
            if (directoryInfo.nameCollision) warn(`Folder ${projectName} already exists`)
            config.filesDir = `${config.projectDir}/files`
            debug(`Files directory: ${config.filesDir}`)
            await fs.mkdir(config.filesDir, { recursive: true })
            return
        }
        case "loadPersistedState": {
            if (!config.projectDir) return
            await runtime.metadata.initialize(config.projectDir)
            debug(`Loaded persisted metadata for ${pluralize(runtime.metadata.size(), "file")}`)
            return
        }
        case "noteEmittedSyncPhase":
            runtime.noteEmittedSyncPhase(op.phase)
            return
        case "resetDisconnectState":
            runtime.disconnectUi.reset()
            return
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
    const { runtime, config, syncState, shutdown } = ctx
    const fileMetadataCache = runtime.metadata
    const memory = runtime.memoryHandle()
    const installer = runtime.installer

    // 1. logs
    if (result.logs) for (const entry of result.logs) emitLog(entry)

    // 2. pre-send runtime ops — applyRuntimeOp is the single mutation site and
    // handles the two async ops (initWorkspace, loadPersistedState) inline.
    const ops = result.runtimeOps ?? []
    for (const op of ops) {
        if (!isPreSendRuntimeOp(op)) continue
        await applyRuntimeOp(op, runtime, config)
    }

    // 3. writes — filter echoes, write, then record metadata via applyRuntimeOp (single mutation site)
    if (result.writes?.files && config.filesDir) {
        const filesToWrite =
            result.writes.skipEcho === true ? filterEchoedFiles(result.writes.files, memory) : result.writes.files

        if (result.writes.skipEcho && filesToWrite.length !== result.writes.files.length) {
            const skipped = result.writes.files.length - filesToWrite.length
            debug(`Skipped ${pluralize(skipped, "echoed change")}`)
        }

        if (filesToWrite.length > 0) {
            await writeRemoteFiles(filesToWrite, config.filesDir, memory, installer ?? undefined)
            for (const file of filesToWrite) {
                if (!result.writes.silent) fileDown(file.name)
                await applyRuntimeOp(
                    {
                        op: "recordRemoteApplied",
                        path: file.name,
                        content: file.content,
                        modifiedAt: file.modifiedAt ?? Date.now(),
                    },
                    runtime,
                    config
                )
            }
        }
    }

    // 4. deletes — markDeleteBeforeUnlink is handled inside deleteLocalFile; then recordDelete runtimeOp
    if (result.deletes && config.filesDir) {
        for (const fileName of result.deletes) {
            await deleteLocalFile(fileName, config.filesDir, memory)
            fileDelete(fileName)
            await applyRuntimeOp({ op: "recordDelete", path: fileName }, runtime, config)
        }
    }

    // 5. sends — on any successful `file-change`: fileUp + installerProcess
    let sawSuccessfulFileChange = false
    if (result.sends && syncState.socket) {
        for (const payload of result.sends) {
            try {
                const sent = await sendMessage(syncState.socket, payload)
                if (sent && payload.type === "file-change") sawSuccessfulFileChange = true
            } catch {
                const label = payload.type === "file-change" ? payload.fileName : payload.type
                warn(`Failed to push ${label}`)
            }
        }
    }
    if (sawSuccessfulFileChange) {
        if (result.fileUp) fileUp(result.fileUp)
        if (result.installerProcess && installer) {
            installer.process(result.installerProcess.fileName, result.installerProcess.content)
        }
    }

    // 6. awaitPrompt — runtime.request{Delete,Conflict}Decisions awaits the plugin's
    // reply. The Promise is resolved by handleMessage (out-of-queue) calling
    // runtime.resolvePendingAction BEFORE enqueuing the follow-up SyncEvent, so this
    // await cannot deadlock the serial EventQueue.
    if (result.awaitPrompt) {
        if (result.awaitPrompt.kind === "deleteConfirmation") {
            try {
                const confirmedFiles = await runtime.requestDeleteDecision(syncState.socket, {
                    fileNames: result.awaitPrompt.fileNames,
                    requireConfirmation: result.awaitPrompt.requireConfirmation,
                })

                for (const fileName of confirmedFiles) {
                    await applyRuntimeOp({ op: "recordDelete", path: fileName }, runtime, config)
                    fileDelete(fileName)
                }

                if (confirmedFiles.length > 0 && syncState.socket) {
                    await sendMessage(syncState.socket, {
                        type: "file-delete",
                        fileNames: confirmedFiles,
                    })
                }
            } catch (err) {
                warn(
                    `Failed to handle deletion for ${result.awaitPrompt.fileNames.join(", ")}: ${String(err)}`
                )
            }
        } else {
            await runtime.requestConflictDecisions(syncState.socket, result.awaitPrompt.conflicts)
        }
    }

    // 7. post-send runtime ops
    for (const op of ops) {
        if (isPreSendRuntimeOp(op)) continue
        await applyRuntimeOp(op, runtime, config)
    }

    // 8. persistState
    if (result.persistState) await fileMetadataCache.flush()

    // 9. tryGitInit — first-sync only, best effort
    if (result.tryGitInit && config.projectDir) {
        tryGitInit(config.projectDir)
    }

    // 10. shutdown (SYNC_COMPLETE with config.once). Status log already in step 1.
    if (result.shutdown) {
        await shutdown()
    }

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
            if (config.projectDir && !runtime.installer) {
                runtime.installer = new Installer({
                    projectDir: config.projectDir,
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
        if (!config.projectDir || !runtime.installer) {
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
                if (!message.session || message.session.connectionId !== runtime.connectionId) {
                    warn("Ignoring stale delete-confirmed (session mismatch)")
                    return
                }
                const { session } = message
                for (const fileName of message.fileNames) {
                    const handled = runtime.resolvePendingAction(deletePromptActionId(session, fileName), true)

                    if (!handled) {
                        warn(`Ignoring stale delete confirmation for ${fileName}`)
                    }
                }

                return
            }

            case "delete-cancelled": {
                if (!message.session || message.session.connectionId !== runtime.connectionId) {
                    warn("Ignoring stale delete-cancelled (session mismatch)")
                    return
                }
                const { session } = message
                for (const file of message.files) {
                    const handled = runtime.resolvePendingAction(deletePromptActionId(session, file.fileName), false)
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
                    runtime.deletePendingRename(normalizeCodeFilePathWithExtension(message.fileName))
                }
                warn(message.message)
                return

            case "conflicts-resolved": {
                if (!message.session || message.session.connectionId !== runtime.connectionId) {
                    warn("Ignoring stale conflicts-resolved (session mismatch)")
                    return
                }
                const { session, resolution, fileNames } = message
                for (const fileName of fileNames) {
                    runtime.resolvePendingAction(conflictPromptActionId(session, fileName), resolution)
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
