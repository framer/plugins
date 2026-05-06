export type ScheduledTask = "disconnectNotice" | "expectedDeleteEchoExpiry" | "renameBuffer" | "sanitizationEchoExpiry"

export const TIMINGS = {
    /** Delay before showing "disconnected" in CLI status (allows quick tab switches). */
    disconnectNotice: 4_000,
    /** Delete-echo suppression window. */
    expectedDeleteEchoExpiry: 5_000,
    /** Watcher rename/add/delete coalesce window. */
    renameBuffer: 100,
    /** Suppress chokidar echo after on-disk path sanitization rename (3x rename buffer). */
    sanitizationEchoExpiry: 300,
} as const

/**
 * Named timers for the CLI. Supports optional `key` for concurrent same-task schedules
 * (e.g. per-path rename buffers, per-path expected delete echoes).
 */
export interface Scheduler {
    after(task: ScheduledTask, delayMs: number, fn: () => void, key?: string): void
    cancel(task: ScheduledTask, key?: string): void
    cancelAll(): void
}

function timerId(task: ScheduledTask, key?: string): string {
    return key !== undefined ? `${task}:${key}` : task
}

export function createScheduler(): Scheduler {
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    return {
        after(task, delayMs, fn, key) {
            const id = timerId(task, key)
            const existing = timers.get(id)
            if (existing !== undefined) {
                clearTimeout(existing)
            }
            const handle = setTimeout(() => {
                timers.delete(id)
                fn()
            }, delayMs)
            timers.set(id, handle)
        },

        cancel(task, key) {
            const id = timerId(task, key)
            const handle = timers.get(id)
            if (handle !== undefined) {
                clearTimeout(handle)
                timers.delete(id)
            }
        },

        cancelAll() {
            for (const handle of timers.values()) {
                clearTimeout(handle)
            }
            timers.clear()
        },
    }
}
