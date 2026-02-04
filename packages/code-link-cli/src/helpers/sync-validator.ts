/**
 * Sync Validation Helper
 *
 * Pure functions for validating incoming changes during live sync.
 * Determines if a change should be applied, queued, or rejected.
 */

import type { FileSyncMetadata } from "../utils/file-metadata-cache.ts"

/**
 * Result of validating an incoming file change
 */
export type ChangeValidation =
    | { action: "apply"; reason: "new-file" | "safe-update" }
    | { action: "queue"; reason: "snapshot-in-progress" }
    | { action: "reject"; reason: "stale-base" | "unknown-file" }

/**
 * Validates whether an incoming REMOTE file change should be applied
 *
 * During watching mode, we trust remote changes and apply them immediately.
 * During snapshot_processing, we queue them for later (to avoid race conditions).
 *
 * Note: This is for INCOMING changes from remote. Local changes (from watcher)
 * are handled separately and always sent during watching mode.
 */
export function validateIncomingChange(fileMeta: FileSyncMetadata | undefined, currentMode: string): ChangeValidation {
    // Queue changes that arrive during snapshot processing
    if (currentMode === "snapshot_processing" || currentMode === "handshaking") {
        return { action: "queue", reason: "snapshot-in-progress" }
    }

    // During watching, apply changes immediately
    if (currentMode === "watching") {
        if (!fileMeta) {
            // New file from remote
            return { action: "apply", reason: "new-file" }
        }

        // Existing file - trust the remote (we're in steady state)
        return { action: "apply", reason: "safe-update" }
    }

    // During conflict resolution, queue for now (could be enhanced later)
    if (currentMode === "conflict_resolution") {
        return { action: "queue", reason: "snapshot-in-progress" }
    }

    // Shouldn't receive changes while disconnected
    return { action: "reject", reason: "unknown-file" }
}
