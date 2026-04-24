// Shared types between plugin and CLI

/** Coarse sync lifecycle phase from CLI → plugin (effect-stable; not internal runtime state). */
export type SyncPhase = "initial_sync" | "ready"

/** Custom close code sent when a new plugin tab replaces the active one. */
export const CLOSE_CODE_REPLACED = 4001

/** Identifies a user prompt across reconnects (CLI mints per prompt). */
export interface PromptSession {
    connectionId: number
    promptId: string
}

export interface ProjectInfo {
    id: string
    name: string
}

export interface PendingDelete {
    fileName: string
    content?: string
}

/** File with content to restore when delete is cancelled - content is required */
export interface CancelledDelete {
    fileName: string
    content: string
}

export interface ConflictSummary {
    fileName: string
    /** null means the file was deleted on this side */
    localContent: string | null
    /** null means the file was deleted on this side */
    remoteContent: string | null
}

export interface FileInfo {
    name: string
    content: string
    modifiedAt?: number
}

// Conflict version data for version requests/responses
export interface ConflictVersionRequest {
    fileName: string
    lastSyncedAt?: number
}

export interface ConflictVersionData {
    fileName: string
    latestRemoteVersionMs?: number
}

// CLI → Plugin messages
export type CliToPluginMessage =
    | { type: "request-files" }
    | { type: "file-list"; files: FileInfo[] }
    | { type: "sync-phase"; phase: SyncPhase }
    | { type: "file-change"; fileName: string; content: string }
    | { type: "file-delete"; fileNames: string[]; requireConfirmation: true; session: PromptSession }
    | { type: "file-delete"; fileNames: string[]; requireConfirmation?: false }
    | { type: "delete-prompt-cleared"; session: PromptSession; fileNames?: string[] }
    | { type: "file-rename"; oldFileName: string; newFileName: string; content: string }
    | { type: "conflicts-detected"; conflicts: ConflictSummary[]; session: PromptSession }
    | { type: "conflicts-cleared"; session: PromptSession }
    | {
          type: "conflict-version-request"
          conflicts: ConflictVersionRequest[]
      }
const cliToPluginMessageTypes = [
    "request-files",
    "file-list",
    "sync-phase",
    "file-change",
    "file-delete",
    "delete-prompt-cleared",
    "file-rename",
    "conflicts-detected",
    "conflicts-cleared",
    "conflict-version-request",
] as const

export function isCliToPluginMessage(data: unknown): data is CliToPluginMessage {
    if (typeof data !== "object" || data === null) return false
    if (!("type" in data) || typeof data.type !== "string") return false
    return cliToPluginMessageTypes.includes(data.type as (typeof cliToPluginMessageTypes)[number])
}

// Plugin → CLI messages
export type PluginToCliMessage =
    | { type: "handshake"; projectId: string; projectName: string }
    | { type: "request-files" }
    | { type: "file-list"; files: FileInfo[] }
    | { type: "file-change"; fileName: string; content: string }
    | { type: "file-delete"; fileNames: string[] }
    | { type: "delete-confirmed"; fileNames: string[]; session: PromptSession }
    | { type: "delete-cancelled"; files: CancelledDelete[]; session: PromptSession }
    | { type: "file-synced"; fileName: string; remoteModifiedAt: number }
    | {
          type: "conflicts-resolved"
          resolution: "local" | "remote"
          session: PromptSession
          fileNames: string[]
      }
    | {
          type: "conflict-version-response"
          versions: ConflictVersionData[]
      }
    | { type: "error"; fileName?: string; message: string }
