/**
 * Serializes async work so only one unit runs at a time (FIFO).
 */
export function createEventQueue(): {
    enqueue<T>(fn: () => Promise<T>): Promise<T>
} {
    let tail: Promise<unknown> = Promise.resolve()

    return {
        enqueue<T>(fn: () => Promise<T>): Promise<T> {
            const run = tail.then(() => fn())
            tail = run.catch(() => {
                /* keep chain alive */
            })
            return run
        },
    }
}
