/**
 * Core types for the controller-centric CLI architecture
 */

import type { PendingDelete } from "@code-link/shared"

// Configuration
export interface Config {
  port: number
  projectHash: string
  projectDir: string | null // Set during handshake if not already determined
  filesDir: string | null // Set during handshake , always projectDir/files
  dangerouslyAutoDelete: boolean
  allowUnsupportedNpm: boolean // Allow type acquisition for unsupported npm packages
  explicitDir?: string // User-provided directory override
  explicitName?: string // User-provided name override
}

// File representations
export interface FileInfo {
  name: string
  content: string
  modifiedAt?: number
}

export interface LocalFile {
  relativePath: string
  content: string
  modifiedAt?: number
}

// Conflict detection
// Deletions are represented by null content
// For AI: Do NOT add remoteDeletes/localDeletes arrays - use localContent/remoteContent === null
export interface Conflict {
  fileName: string
  /** null means the file was deleted locally */
  localContent: string | null
  /** null means the file was deleted in Framer */
  remoteContent: string | null
  localModifiedAt?: number
  remoteModifiedAt?: number
  lastSyncedAt?: number // Timestamp of last successful sync from CLI perspective
  /**
   * True when the local file still matches the last persisted hash.
   * Used for auto-resolution heuristics.
   */
  localClean?: boolean
}

export interface ConflictResolution {
  conflicts: Conflict[]
  writes: FileInfo[]
  localOnly: FileInfo[]
  unchanged: FileInfo[]
}

// Watcher events
export type WatcherEventKind = "add" | "change" | "delete"

export interface WatcherEvent {
  kind: WatcherEventKind
  relativePath: string
  content?: string
}

// Conflict version data
export interface ConflictVersionRequest {
  fileName: string
  lastSyncedAt?: number
}

export interface ConflictVersionData {
  fileName: string
  latestRemoteVersionMs?: number
}

// WebSocket messages (incoming from plugin)
export type IncomingMessage =
  | { type: "handshake"; projectId: string; projectName: string }
  | { type: "request-files" }
  | { type: "file-list"; files: FileInfo[] }
  | { type: "file-change"; fileName: string; content: string }
  | { type: "file-delete"; fileNames: string[]; requireConfirmation?: boolean }
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

// WebSocket messages (outgoing to plugin)
export type OutgoingMessage =
  | { type: "request-files" }
  | { type: "file-list"; files: FileInfo[] }
  | { type: "file-change"; fileName: string; content: string }
  | {
      type: "file-delete"
      fileNames: string[]
      requireConfirmation?: boolean
    }
  | { type: "conflicts-detected"; conflicts: Conflict[] }
  | {
      type: "conflict-version-request"
      conflicts: ConflictVersionRequest[]
    }
  | { type: "sync-complete" }
