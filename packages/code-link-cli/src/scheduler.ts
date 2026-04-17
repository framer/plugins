import type { ScheduledTask } from "./timings.ts"

export type { ScheduledTask } from "./timings.ts"

/**
 * Named timers for the CLI. Supports optional `key` for concurrent same-task schedules
 * (e.g. per-path rename buffers, per-path tombstones).
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
