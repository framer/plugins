/**
 * Core types for the controller-centric CLI architecture
 */

// Re-export shared types for convenience
export type {
  FileInfo,
  ConflictVersionRequest,
  ConflictVersionData,
  CliToPluginMessage,
  PluginToCliMessage,
} from "@code-link/shared"

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

// Local file representation (CLI-specific)
export interface LocalFile {
  relativePath: string
  content: string
  modifiedAt?: number
}

// Conflict detection (CLI-specific - extends shared ConflictSummary with more fields)
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

// Re-import FileInfo for use in ConflictResolution
import type { FileInfo } from "@code-link/shared"

export interface ConflictResolution {
  conflicts: Conflict[]
  writes: FileInfo[]
  localOnly: FileInfo[]
  unchanged: FileInfo[]
}

// Watcher events (CLI-specific)
export type WatcherEventKind = "add" | "change" | "delete"

export interface WatcherEvent {
  kind: WatcherEventKind
  relativePath: string
  content?: string
}
