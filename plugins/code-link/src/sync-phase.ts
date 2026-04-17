import type { Mode, SyncPhase } from "@code-link/shared"

/** Maps CLI-reported sync phase to background UI mode (prompt layers take precedence in the reducer). */
export function modeFromSyncPhase(syncPhase: SyncPhase | null): Mode {
    switch (syncPhase) {
        case "initial_sync":
            return "syncing"
        case "ready":
            return "idle"
        default:
            return "loading"
    }
}
