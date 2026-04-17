import type { CliSyncMode, Mode } from "@code-link/shared"

export function modeFromSyncMode(syncMode: CliSyncMode | null): Mode {
    switch (syncMode) {
        case "handshaking":
        case "snapshot_processing":
        case "conflict_resolution":
            return "syncing"
        case "watching":
            return "idle"
        default:
            return "loading"
    }
}
