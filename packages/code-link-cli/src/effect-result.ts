import type { CliToPluginMessage, PromptSession, SyncPhase } from "@code-link/shared"
import type { SyncEvent } from "./sync-events.ts"
import type { Conflict, FileInfo } from "./types.ts"

/**
 * Every mutation the apply pipeline can perform on SyncRuntime/SyncMemory.
 * Send-success mutations live on SendIntent.onSent so they cannot run before
 * the socket write succeeds.
 */
export type RuntimeOp =
    | { op: "recordLocalSend"; path: string; content: string }
    | { op: "recordRemoteApplied"; path: string; content: string; modifiedAt: number }
    | { op: "recordDelete"; path: string }
    | { op: "registerPendingRename"; oldPath: string; newPath: string; content: string }
    | { op: "completePendingRename"; newPath: string }
    | { op: "clearContentEcho"; path: string }
    | { op: "clearDeleteTombstone"; path: string }
    | { op: "initWorkspace"; projectInfo: { projectId: string; projectName: string } }
    | { op: "loadPersistedState" }
    | { op: "noteEmittedSyncPhase"; phase: SyncPhase }
    | { op: "resetDisconnectState" }
    | { op: "clearDeletePromptFiles"; session: PromptSession; fileNames: string[] }
    | { op: "clearConflictPromptFiles"; session: PromptSession; fileNames: string[] }
    | { op: "invalidateDeletePromptPath"; path: string }
    | { op: "updateActiveConflictLocal"; path: string; content: string | null; modifiedAt?: number }
    | { op: "updateActiveConflictRemote"; path: string; content: string | null; modifiedAt?: number }

export type LogLevel = "info" | "debug" | "warn" | "success" | "status"

export interface LogEntry {
    level: LogLevel
    message: string
}

/**
 * A prompt update that apply sends to the plugin. Prompt decisions return
 * later as ordinary SyncEvents; apply never waits for a user decision.
 */
export type PromptIntent =
    | { kind: "deleteConfirmation"; fileNames: string[]; requireConfirmation: boolean }
    | { kind: "conflictDecisions"; conflicts: Conflict[] }

export interface SendIntent {
    message: CliToPluginMessage
    onSent?: RuntimeOp[]
    fileUp?: string
    installerProcess?: { fileName: string; content: string }
}

/**
 * Declarative description of what one effect should do.
 *
 * Every field is optional — an effect that needs nothing (e.g. ignored event)
 * returns `{}`. The apply pipeline consumes fields in this fixed order:
 *
 *   1. logs            — emit each entry through the matching log fn
 *   2. pre-send rOps   — workspace init, echo cleanup, active conflict updates
 *   3. writes          — filterEchoedFiles (if skipEcho), then writeRemoteFiles;
 *                        fileDown per file unless silent;
 *                        metadata recorded post-disk inside this step
 *   4. deletes         — arm delete tombstone + fs.unlink (via deleteLocalFile);
 *                        fileDelete + recordDelete on success
 *   5. sends           — sendMessage each; successful sends apply onSent ops
 *                        and optional fileUp/installerProcess
 *   6. prompt          — register prompt state, send UI state, return
 *   7. post-send rOps  — recordRemoteApplied, completePendingRename,
 *                        prompt clears, noteEmittedSyncPhase, resetDisconnectState
 *   8. persistState    — metadata cache flush
 *   9. tryGitInit      — first-sync, best-effort
 *  10. shutdown        — call ctx.shutdown() (the `logs[*].level === "status"`
 *                        "Sync complete, exiting..." is emitted in step 1)
 *  11. followUps       — returned as SyncEvent[]; runtime enqueues inline
 */
export interface EffectResult {
    logs?: LogEntry[]
    runtimeOps?: RuntimeOp[]
    sends?: SendIntent[]
    writes?: { files: FileInfo[]; silent?: boolean; skipEcho?: boolean }
    deletes?: string[]
    prompt?: PromptIntent
    refreshConflictPrompt?: boolean
    refreshDeletePrompt?: boolean
    persistState?: boolean
    /** Best-effort git init on first sync if the workspace was just created. */
    tryGitInit?: boolean
    /** SYNC_COMPLETE in `config.once` mode calls ctx.shutdown() after everything else. */
    shutdown?: boolean
    /** Follow-up SyncEvents to enqueue inline. */
    followUps?: SyncEvent[]
}

export type { SyncEvent }
