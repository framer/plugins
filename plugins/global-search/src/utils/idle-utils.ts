/**
 * The idle time threshold in milliseconds.
 * This is based on (1000ms / 120fps) - some time to render, etc.
 */
const idleTimeThreshold = 7

const getIdleCallback =
    // Safari doesn't support requestIdleCallback, so we need to shim it
    // This affects Safari versions before 16.4 (released March 2023)
    (typeof requestIdleCallback !== "undefined" ? requestIdleCallback : null) ??
    ((cb: IdleRequestCallback) => {
        const start = performance.now()
        return setTimeout(() => {
            cb({
                didTimeout: false,
                timeRemaining: () => Math.max(0, idleTimeThreshold - (performance.now() - start)),
            })
        }, 1)
    })

export function waitForIdle(): Promise<{
    timeRemaining: () => number
}> {
    return new Promise(resolve => {
        getIdleCallback(deadline => {
            resolve(deadline)
        })
    })
}
