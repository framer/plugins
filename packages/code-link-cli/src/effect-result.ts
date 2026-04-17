import type { CliToPluginMessage } from "@code-link/shared"
import type { FileInfo } from "./types.ts"
import type { ScheduledTask } from "./timings.ts"

export type KernelOp =
    | { op: "recordLocalSend"; path: string; content: string }
    | { op: "recordRemoteApplied"; path: string; hash: string; modifiedAt: number }
    | { op: "recordDelete"; path: string }
    | { op: "registerPendingRename"; oldPath: string; newPath: string; content: string }
    | { op: "completePendingRename"; newPath: string }
    | { op: "schedule"; name: ScheduledTask; delayMs: number }
    | { op: "cancel"; name: ScheduledTask; key?: string }

export type LogLevel = "info" | "debug" | "warn" | "success"

/**
 * Declarative outcome of executing one effect. Runtime applies kernelOps, I/O, then follow-ups.
 */
export interface EffectResult {
    kernelOps?: KernelOp[]
    sends?: CliToPluginMessage[]
    /** Remote writes from CLI perspective (disk). */
    writes?: { files: FileInfo[]; silent?: boolean; skipEcho?: boolean }
    deletes?: string[]
    log?: { level: LogLevel; message: string }
    /** Persist metadata to disk (debounced inside cache). */
    persistState?: boolean
    /** After successful send: CLI file-up indicator. */
    fileUp?: string
    /** Run installer.process after send. */
    installerProcess?: { fileName: string; content: string }
}
