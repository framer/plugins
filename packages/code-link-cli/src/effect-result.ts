import type { CliToPluginMessage, SyncPhase } from "@code-link/shared"
import type { Conflict, FileInfo } from "./types.ts"
import type { SyncEvent } from "./sync-events.ts"

/**
 * Every mutation the apply pipeline can perform on the SyncRuntime (or its
 * embedded caches). Classified pre-send vs. post-send by PRE_SEND_RUNTIME_OPS
 * in controller.ts.
 */
export type RuntimeOp =
    | { op: "recordLocalSend"; path: string; content: string }
    | { op: "recordRemoteApplied"; path: string; content: string; modifiedAt: number }
    | { op: "recordDelete"; path: string }
    | { op: "registerPendingRename"; oldPath: string; newPath: string; content: string }
    | { op: "completePendingRename"; newPath: string }
    | { op: "forgetPath"; path: string }
    | { op: "clearDeleteTombstone"; path: string }
    | { op: "initWorkspace"; projectInfo: { projectId: string; projectName: string } }
    | { op: "loadPersistedState" }
    | { op: "noteEmittedSyncPhase"; phase: SyncPhase }
    | { op: "resetDisconnectState" }

export type LogLevel = "info" | "debug" | "warn" | "success" | "status"

export interface LogEntry {
    level: LogLevel
    message: string
}

/**
 * A prompt that the apply pipeline should send to the plugin and await a
 * user decision on. Apply calls the runtime prompt coordinator, which mints
 * the session id and routes incoming responses back into the pipeline.
 */
export type AwaitPromptOp =
    | { kind: "deleteConfirmation"; fileNames: string[]; requireConfirmation: boolean }
    | { kind: "conflictDecisions"; conflicts: Conflict[] }

/**
 * Declarative description of what one effect should do.
 *
 * Every field is optional — an effect that needs nothing (e.g. ignored event)
 * returns `{}`. The apply pipeline consumes fields in this fixed order:
 *
 *   1. logs            — emit each entry through the matching log fn
 *   2. pre-send rOps   — recordLocalSend, registerPendingRename, recordDelete,
 *                        forgetPath, clearDeleteTombstone, initWorkspace,
 *                        loadPersistedState
 *   3. writes          — filterEchoedFiles (if skipEcho), then writeRemoteFiles;
 *                        fileDown per file unless silent;
 *                        metadata recorded post-disk inside this step
 *   4. deletes         — markDeleteBeforeUnlink + fs.unlink (via deleteLocalFile);
 *                        fileDelete + recordDelete on success
 *   5. sends           — sendMessage each; on any successful `file-change`:
 *                        fileUp + installerProcess (if set)
 *   6. awaitPrompt     — runtime.request{Delete,Conflict}Decisions; resulting
 *                        confirmations flow back through post-send paths
 *   7. post-send rOps  — recordRemoteApplied, completePendingRename,
 *                        noteEmittedSyncPhase, resetDisconnectState
 *   8. persistState    — metadata cache flush
 *   9. tryGitInit      — first-sync, best-effort
 *  10. shutdown        — call ctx.shutdown() (the `logs[*].level === "status"`
 *                        "Sync complete, exiting..." is emitted in step 1)
 *  11. followUps       — returned as SyncEvent[]; runtime enqueues inline
 */
export interface EffectResult {
    logs?: LogEntry[]
    runtimeOps?: RuntimeOp[]
    sends?: CliToPluginMessage[]
    writes?: { files: FileInfo[]; silent?: boolean; skipEcho?: boolean }
    deletes?: string[]
    /** If any `file-change` in `sends` succeeded: emit the file-up indicator. */
    fileUp?: string
    /** If any `file-change` in `sends` succeeded: run installer.process. */
    installerProcess?: { fileName: string; content: string }
    awaitPrompt?: AwaitPromptOp
    persistState?: boolean
    /** Best-effort git init on first sync if the workspace was just created. */
    tryGitInit?: boolean
    /** SYNC_COMPLETE in `config.once` mode calls ctx.shutdown() after everything else. */
    shutdown?: boolean
    /** Follow-up SyncEvents to enqueue inline. */
    followUps?: SyncEvent[]
}

export type { SyncEvent }
