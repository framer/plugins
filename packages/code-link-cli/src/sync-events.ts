/**
 * Event + Effect + State types for the CLI state machine.
 *
 * Kept separate from the controller so tests and helper modules can reference
 * the state-machine vocabulary without importing controller startup code.
 */

import type { CancelledDelete, CliToPluginMessage, PromptSession, SyncStatus } from "@code-link/shared"
import type { WebSocket } from "ws"
import type { Conflict, ConflictVersionData, FileInfo, WatcherEvent } from "./types.ts"
import type { LogEntryLevel } from "./utils/logging.ts"

export type WriteEchoPolicy = "authoritative" | "skip-expected-echoes"

export type DisconnectedState = {
    phase: "disconnected"
    socket: null
}

export type HandshakingState = {
    phase: "handshaking"
    socket: WebSocket
}

export type SnapshotProcessingState = {
    phase: "snapshot_processing"
    socket: WebSocket
}

export type ConflictResolutionState = {
    phase: "conflict_resolution"
    socket: WebSocket
    pendingConflicts: Conflict[]
}

export type WatchingState = {
    phase: "watching"
    socket: WebSocket
}

/**
 * `phase` is the controller's private state-machine phase.
 * Keep it distinct from plugin-visible `sync-status` messages.
 */
export type SyncState =
    | DisconnectedState
    | HandshakingState
    | SnapshotProcessingState
    | ConflictResolutionState
    | WatchingState

export type SyncEvent =
    | {
          type: "HANDSHAKE"
          socket: WebSocket
          projectInfo: { projectId: string; projectName: string }
      }
    | { type: "REQUEST_FILES" }
    | { type: "REMOTE_FILE_LIST"; files: FileInfo[] }
    | {
          type: "CONFLICTS_DETECTED"
          conflicts: Conflict[]
          safeWrites: FileInfo[]
          localOnly: FileInfo[]
          /** How many files the remote sent in this snapshot — drives SYNC_COMPLETE accounting. */
          remoteTotal: number
      }
    /**
     * Duplicate handshake from an already-active socket. Rebroadcast whichever
     * sync-status we last emitted so the plugin's UI catches up.
     */
    | { type: "RESEND_SYNC_STATUS"; status: SyncStatus }
    | { type: "REMOTE_FILE_CHANGE"; file: FileInfo }
    | { type: "REMOTE_FILE_DELETE"; fileName: string }
    | { type: "DELETE_CONFIRMED"; session: PromptSession; fileNames: string[] }
    | { type: "DELETE_CANCELLED"; session: PromptSession; files: CancelledDelete[] }
    | { type: "CONFLICTS_RESOLVED"; session: PromptSession; resolution: "local" | "remote"; fileNames: string[] }
    | {
          type: "FILE_SYNCED_CONFIRMATION"
          fileName: string
          remoteModifiedAt: number
      }
    | { type: "DISCONNECT" }
    | { type: "WATCHER_EVENT"; event: WatcherEvent }
    | {
          type: "RESOLVE_PENDING_CONFLICTS_WITH_VERSIONS"
          versions: ConflictVersionData[]
      }

export type Effect =
    | {
          type: "INIT_WORKSPACE"
          projectInfo: { projectId: string; projectName: string }
      }
    | { type: "LOAD_PERSISTED_STATE" }
    | { type: "SEND_MESSAGE"; payload: CliToPluginMessage }
    | { type: "EMIT_SYNC_STATUS"; status: SyncStatus }
    | { type: "LIST_LOCAL_FILES" }
    | { type: "DETECT_CONFLICTS"; remoteFiles: FileInfo[] }
    | {
          type: "WRITE_FILES"
          files: FileInfo[]
          silent?: boolean
          /**
           * Live Framer file-change messages may echo a local send we just made.
           * Snapshot/conflict writes are authoritative and must not be filtered.
           */
          echoPolicy: WriteEchoPolicy
      }
    | { type: "DELETE_LOCAL_FILES"; names: string[] }
    | { type: "REQUEST_CONFLICT_DECISIONS"; conflicts: Conflict[] }
    | { type: "REQUEST_CONFLICT_VERSIONS"; conflicts: Conflict[] }
    | {
          type: "UPDATE_FILE_METADATA"
          fileName: string
          remoteModifiedAt: number
      }
    | {
          type: "SEND_LOCAL_CHANGE"
          fileName: string
          content: string
      }
    | {
          type: "LOCAL_INITIATED_FILE_DELETE"
          fileNames: string[]
      }
    | {
          type: "RESOLVE_DELETE_PROMPT"
          session: PromptSession
          confirmedFileNames: string[]
          cancelledFiles: CancelledDelete[]
      }
    | {
          type: "RESOLVE_CONFLICT_PROMPT"
          session: PromptSession
          resolution: "local" | "remote"
          fileNames: string[]
      }
    | {
          type: "UPDATE_ACTIVE_CONFLICT_LOCAL"
          fileName: string
          content: string | null
          modifiedAt?: number
      }
    | {
          type: "UPDATE_ACTIVE_CONFLICT_REMOTE"
          fileName: string
          content: string | null
          modifiedAt?: number
      }
    | {
          type: "INVALIDATE_DELETE_PROMPT_PATH"
          fileName: string
      }
    | {
          type: "SEND_FILE_RENAME"
          oldFileName: string
          newFileName: string
          content: string
      }
    | { type: "PERSIST_STATE" }
    | {
          type: "SYNC_COMPLETE"
          totalCount: number
          updatedCount: number
          unchangedCount: number
      }
    | {
          type: "LOG"
          level: LogEntryLevel
          message: string
      }
