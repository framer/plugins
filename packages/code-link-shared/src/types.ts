// Shared types between plugin and CLI

export type Mode =
  | "loading"
  | "info"
  | "syncing"
  | "delete_confirmation"
  | "conflict_resolution"
  | "idle"

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

// CLI → Plugin messages
export type IncomingMessage =
  | { type: "request-files" }
  | { type: "file-change"; fileName: string; content: string }
  | {
      type: "file-delete"
      fileNames: string[]
      requireConfirmation?: boolean
    }
  | { type: "conflicts-detected"; conflicts: ConflictSummary[] }
  | {
      type: "conflict-version-request"
      conflicts: Array<{ fileName: string; lastSyncedAt?: number }>
    }
  | { type: "sync-complete" }

// Plugin → CLI messages
export type OutgoingMessage =
  | { type: "handshake"; projectId: string; projectName: string }
  | { type: "file-list"; files: FileInfo[] }
  | { type: "file-change"; fileName: string; content: string }
  | { type: "file-delete"; fileNames: string[] }
  | { type: "delete-confirmed"; fileNames: string[] }
  | { type: "delete-cancelled"; files: PendingDelete[] }
  | { type: "file-synced"; fileName: string; remoteModifiedAt: number }
  | {
      type: "conflict-resolution"
      fileName: string
      resolution: "local" | "remote"
    }
  | {
      type: "conflict-version-response"
      versions: Array<{ fileName: string; latestRemoteVersionMs?: number }>
    }
