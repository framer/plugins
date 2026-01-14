// Shared types between plugin and CLI

export type Mode = "loading" | "info" | "syncing" | "delete_confirmation" | "conflict_resolution" | "idle"

export interface ProjectInfo {
    id: string
    name: string
}

export interface PendingDelete {
    fileName: string
    content?: string
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
    | { type: "file-change"; fileName: string; content: string }
    | {
          type: "file-delete"
          fileNames: string[]
          requireConfirmation?: boolean
      }
    | { type: "conflicts-detected"; conflicts: ConflictSummary[] }
    | {
          type: "conflict-version-request"
          conflicts: ConflictVersionRequest[]
      }
    | { type: "sync-complete" }

const cliToPluginMessageTypes = [
    "request-files",
    "file-list",
    "file-change",
    "file-delete",
    "conflicts-detected",
    "conflict-version-request",
    "sync-complete",
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
    | { type: "delete-confirmed"; fileNames: string[] }
    | { type: "delete-cancelled"; files: PendingDelete[] }
    | { type: "file-synced"; fileName: string; remoteModifiedAt: number }
    | {
          type: "conflicts-resolved"
          resolution: "local" | "remote"
      }
    | {
          type: "conflict-version-response"
          versions: ConflictVersionData[]
      }
    | { type: "error"; fileName?: string; message: string }
