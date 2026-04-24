/**
 * Centralized timing constants for the CLI sync runtime.
 * Durations preserve legacy behavior; document rationale when non-obvious.
 */
export type ScheduledTask = "disconnectNotice" | "tombstoneExpiry" | "renameBuffer" | "sanitizationEchoExpiry"

export const TIMINGS = {
    /** Delay before showing "disconnected" in CLI status (allows quick tab switches). */
    disconnectNotice: 4_000,
    /** Delete-echo suppression window (former hash-tracker per-path timeout). */
    tombstoneExpiry: 5_000,
    /** Watcher rename/add/delete coalesce window. */
    renameBuffer: 100,
    /** Suppress chokidar echo after on-disk path sanitization rename (3× rename buffer). */
    sanitizationEchoExpiry: 300,
} as const
