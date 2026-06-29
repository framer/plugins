/* eslint-disable @typescript-eslint/no-unnecessary-condition,@typescript-eslint/no-unsafe-function-type */
"use strict"

// turns on override logs
const DEBUG = false

/** A set to keep track of all deferred callbacks that should run before the page is hidden/unloaded. */
const pendingCallbacks = new Set<VoidFunction>()
const pendingAnimationFrameCallbacks = new Set<VoidFunction>()
let animationFrameScheduled = false

function resolveAnimationFrameCallbacks() {
    animationFrameScheduled = false
    const callbacks = Array.from(pendingAnimationFrameCallbacks)
    // Clear before invoking callbacks so callbacks queued during this drain are scheduled for the next frame.
    pendingAnimationFrameCallbacks.clear()
    for (const callback of callbacks) {
        callback()
    }
}

function queueAfterPaintCallback(callback: VoidFunction) {
    pendingAnimationFrameCallbacks.add(callback)

    // Scheduling tasks can be relatively expensive, so we batch rAFs & timeouts/yields together.
    if (animationFrameScheduled) return
    animationFrameScheduled = true
    requestAnimationFrame(resolveAnimationFrameCallbacks)
}

/** Runs all callbacks that still need to complete before the page is hidden/unloaded. */
function resolvePendingPromises() {
    while (pendingCallbacks.size) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const callback = pendingCallbacks.values().next().value!
        pendingCallbacks.delete(callback)
        callback()
    }
}

declare const scheduler: {
    postTask: (cb: VoidFunction, options: { priority: "background" }) => void
}

const lowPriorityCallback =
    "scheduler" in window && "postTask" in scheduler
        ? (cb: VoidFunction) => {
              scheduler.postTask(cb, { priority: "background" })
          }
        : (cb: VoidFunction) => setTimeout(cb, 1)

let loadPromise: Promise<void> | undefined = new Promise<void>(resolve => {
    window.addEventListener("load", () => {
        resolve()
    })
}).then(() => {
    loadPromise = undefined
})

const isInputPending =
    "scheduling" in navigator &&
    typeof (navigator.scheduling as { isInputPending: () => boolean })?.isInputPending === "function"
        ? (navigator.scheduling as { isInputPending: () => boolean }).isInputPending.bind(navigator.scheduling)
        : () => false

async function queueYieldCallback(callback: VoidFunction, shouldWaitForLoad: boolean) {
    pendingCallbacks.add(callback)

    let timeStamp: number | undefined
    if (DEBUG) {
        timeStamp = performance.now()
    }

    if (shouldWaitForLoad && document.readyState !== "complete") {
        await loadPromise

        if (DEBUG) {
            const newTimeStamp = performance.now()
            // @ts-expect-error TS(2554): TS doesn't know about the new syntax yet
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            console.timeStamp(`load-yield-${timeStamp}`, timeStamp, newTimeStamp, "GTM load", "GTM yield")
            timeStamp = newTimeStamp
        }
    }

    // Callback has already been run
    if (!pendingCallbacks.has(callback)) return

    if (document.hidden) {
        // The tab may have been hidden while we were waiting for load; don't leave this callback behind
        // for a rAF that may never run.
        pendingCallbacks.delete(callback)
        callback()
        return
    }

    const run = () => {
        lowPriorityCallback(() => {
            // A visibility/pagehide flush may have already run this callback synchronously.
            if (!pendingCallbacks.delete(callback)) return

            if (DEBUG)
                // @ts-expect-error TS(2554): TS doesn't know about the new syntax yet
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                console.timeStamp(`yield-${timeStamp}`, timeStamp, performance.now(), "GTM yield", "GTM yield")

            callback()
        })
    }

    queueAfterPaintCallback(() => {
        if (isInputPending()) {
            // Input is pending, so let's wait for the next paint afterwards.
            queueAfterPaintCallback(run)
        } else {
            run()
        }
    })
}

/**
 * This is a modified `yieldUnlessUrgent` tailored to the GTM optimization use-case.
 * The difference is, we batch calls to `requestAnimationFrame` manually and only support lowest priority
 * (`setTimeout(fn, 1)`/postTask background priority)
 */
function yieldUnlessUrgent(callback: VoidFunction, shouldWaitForLoad = false) {
    if (document.hidden) {
        callback()
        return
    }

    void queueYieldCallback(callback, shouldWaitForLoad)
}

let globalWaitingForClickPromise: Promise<void> | undefined
let globalWaitingForClickResolve: (() => void) | undefined

async function getPromiseWithFallback() {
    return new Promise<void>(resolve => {
        const resolveFn = () => {
            pendingCallbacks.delete(resolve)
            resolve()
        }

        globalWaitingForClickResolve = resolveFn

        // Safety fallback in case `click` never fires, where 150ms ensures the delay isn't noticeable by users
        // TODO: Add a log here when `yieldOnTap` ships to stable, so we understand how often this occurs.
        setTimeout(resolveFn, 150)
        pendingCallbacks.add(resolve) // Ensure we resolve when the page becomes hidden
    })
}

function globalWaitForClickListener(event: MouseEvent) {
    if (event.button === 0 /* primary / left mouse button */) {
        globalWaitingForClickPromise = getPromiseWithFallback()
    }
}

function globalClickReceivedListener() {
    globalWaitingForClickPromise = undefined
    globalWaitingForClickResolve?.()
    globalWaitingForClickResolve = undefined
}

document.addEventListener("mousedown", globalWaitForClickListener, true)
document.addEventListener("click", globalClickReceivedListener, true)
// Ensure we resolve when the page becomes hidden
// visibilitychange + pagehide is needed to reliably (±97%) detect when the page is hidden cross-browser
// see https://nicj.net/beaconing-in-practice-fetchlater/#beaconing-in-practice-fetchlater-onload-or-pagehide-or-visibilitychange
document.addEventListener(
    "visibilitychange",
    () => {
        if (document.hidden) {
            resolvePendingPromises()
            globalClickReceivedListener()
        }
    },
    true
)
document.addEventListener(
    "pagehide",
    () => {
        globalClickReceivedListener()
        resolvePendingPromises()
    },
    true
)

type DataLayerPush = (...items: object[]) => boolean
type DataLayer = Omit<object[], "push"> & {
    push: DataLayerPush
    __f?: boolean // flag to indicate if the push function has been overridden
}

// #region document event listener interceptor
// eslint-disable-next-line @typescript-eslint/unbound-method
const originalAddEventListener = document.addEventListener
const typesToIntercept = ["click", "auxclick", "mousedown", "keyup", "submit"] as const
type EventType = (typeof typesToIntercept)[number]

function logEventDiff(event: Event, newEvent: Event) {
    const differentProps: string[] = []
    const missingProps: string[] = []
    let prop: keyof Event
    for (prop in event) {
        if (typeof event[prop] === "function") continue

        const newEventProp = newEvent[prop]
        if (newEventProp === undefined) {
            missingProps.push(prop)
        } else if (event[prop] !== newEventProp) {
            differentProps.push(prop)
        }
    }
    if (differentProps.length || missingProps.length) {
        console.log(`Different: ${differentProps.join(", ")}`, `Missing: ${missingProps.join(", ")}`)
    }
}

document.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options: boolean | AddEventListenerOptions | undefined
) {
    if (typesToIntercept.includes(type as EventType)) {
        if (DEBUG) console.log(`Overriding ${type} listener`, listener)

        originalAddEventListener.call(
            this,
            type,
            async function overriddenEventListener(this: unknown, event: Event) {
                let eventBefore: string | undefined
                if (DEBUG) {
                    eventBefore = JSON.stringify(event)
                }

                // If the event is a `mousedown` and the left mouse button was clicked, we wait for the next `click`
                // event before we yield
                // If click never fires, the promise eventually resolves at pagehide/visibilitychange.
                if (
                    event.type === "mousedown" &&
                    (event as unknown as MouseEvent).button === 0 /* primary / left mouse button */
                ) {
                    await globalWaitingForClickPromise
                }

                yieldUnlessUrgent(() => {
                    if (DEBUG) {
                        logEventDiff(JSON.parse(eventBefore ?? "{}") as Event, event)
                    }

                    if (typeof listener === "function") {
                        listener.call(this, event)
                    } else {
                        listener.handleEvent(event)
                    }
                })
            },
            options
        )
        return
    }

    // Otherwise, we call the original addEventListener function
    originalAddEventListener.call(this, type, listener, options)
}

// #region GTM override
function wrapDataLayerPush(push: DataLayer["push"]) {
    // Must be a (non-async) function, not an arrow function, because we need to bind the original `this` context
    // the GTM dataLayer push function returns `true` if the push was successful, we just assume it is.
    // The `...args` spread is needed so the call results in the exactly same result as the original.
    // The function syntax is important here so we keep the correct `this`.
    return function yieldingPush(this: DataLayer, ...args: object[]) {
        yieldUnlessUrgent(() => {
            // The arrow FN is important here so we keep the correct `this`.
            push.apply(this, args)
        }, true)
        return true
    }
}

/** Overrides the `.push()` function to yield until the next paint. */
function defineCustomDataLayerPush(dataLayer: DataLayer) {
    if (dataLayer.__f) return

    // Initially, we just use the native push function.
    // On first override, we wrap it in our yielding push function.
    // The effect is, it yields between e.g. GTM and GA calls.
    let mostRecentPushWrapper: DataLayer["push"] | undefined = dataLayer.push

    Object.defineProperty(dataLayer, "push", {
        enumerable: true,
        get() {
            return mostRecentPushWrapper
        },
        set(value) {
            if (DEBUG) console.log("set dataLayer.push", value)

            if (value === mostRecentPushWrapper) return // skip for `window.dataLayer = window.dataLayer||[]`
            mostRecentPushWrapper = value ? wrapDataLayerPush(value as DataLayer["push"]) : undefined
        },
    })
    Object.defineProperty(dataLayer, "__f", {
        enumerable: false,
        value: true,
    })
}

/** Ensures that if anyone calls `window.dataLayer = ...`, we immediately override the `.push()` function. */
function overrideGTMDataLayer() {
    let mostRecentDataLayerWrapper = (window as unknown as { dataLayer?: DataLayer }).dataLayer
    if (!mostRecentDataLayerWrapper) return

    defineCustomDataLayerPush(mostRecentDataLayerWrapper)

    Object.defineProperty(window, "dataLayer", {
        enumerable: true, // mimics `window.dataLayer = ...`
        get() {
            return mostRecentDataLayerWrapper
        },
        set(value) {
            if (DEBUG) console.log("set dataLayer", value)

            if (value === mostRecentDataLayerWrapper) return // skip for `window.dataLayer = window.dataLayer||[]`
            mostRecentDataLayerWrapper = value as DataLayer
            if (mostRecentDataLayerWrapper) {
                defineCustomDataLayerPush(mostRecentDataLayerWrapper)
            }
        },
    })
}

const gtmObserver = new MutationObserver(() => {
    if (document.readyState === "complete" && !("dataLayer" in window)) {
        // GTM probably isn't on the page, so we can stop observing.
        gtmObserver.disconnect()
        return
    }
    if ("dataLayer" in window) {
        if (DEBUG) console.log("GTM dataLayer found, overriding")

        gtmObserver.disconnect()
        overrideGTMDataLayer()
    }
})

gtmObserver.observe(document.documentElement, { childList: true, subtree: true })

// #region History/submit wrapper override
/**
 * History/form overrides usually chain by capturing the previous function:
 *
 * ```js
 * const previousPushState = history.pushState
 * history.pushState = function (...args) {
 *     previousPushState.apply(this, args)
 *     // 3p side effects
 * }
 * ```
 *
 * Our wrapper calls the native method immediately, then yields before running the 3p override body. If the
 * override body calls a captured older wrapper, that older wrapper must not call the native method again for
 * the same top-level navigation/submit. Each wrapper therefore gets a generation number, and while wrapper N
 * runs its override body synchronously we mark generations `< N` as "native already handled".
 *
 * Fresh nested calls still work: if an override intentionally calls `history.pushState(...)` again, it goes
 * through the current wrapper, whose generation is `>= N`, so it still calls native. This preserves real nested
 * navigations while suppressing duplicate native calls from captured older wrappers, including stale captures
 * that are older than the immediately previous wrapper.
 *
 * This intentionally targets the observed GTM/router pattern where captured wrappers are called synchronously.
 * Fire-and-forget delayed calls to captured wrappers are not covered; supporting them requires much more global
 * scheduler patching and is not worth the complexity for this optimization.
 */
function overrideListener<T extends object>(target: T, method: keyof T) {
    // @ts-expect-error TS(2339): Prototype chain call. We try __proto__ first, as this will usually be the original method.
    const originalMethod: Function = (target.__proto__ as unknown as T)[method] ?? (target[method] as Function)
    let activeSkipGeneration: number | undefined
    let nextWrappedListenerGeneration = 0

    function wrapListener(value?: Function) {
        const generation = nextWrappedListenerGeneration++
        // the function syntax is important here so we keep the correct `this`.
        function yieldingListener(this: unknown, ...args: unknown[]) {
            if (DEBUG) {
                console.log("Yielding for", originalMethod)
                console.timeStamp(originalMethod as unknown as string)
            }

            // We first call the original: This optimizes for UX & correctness of React components.
            // e.g., for pushState, when a component renders on a new route, it might set state and/or read from the URL. If the URL isn't
            // accurate, it might lead to wrong behavior.
            // If an override calls a previously captured wrapper, that older wrapper skips the native method;
            // fresh calls through the current getter still update history/submit normally.
            if (activeSkipGeneration === undefined || generation >= activeSkipGeneration) {
                originalMethod.apply(this, args)
            }

            if (!value) return

            // If `method` is overriden N times, it creates N yield points (as overrides might be chained)
            yieldUnlessUrgent(() => {
                // The arrow FN is important here so we keep the correct `this`.
                const previousActiveSkipGeneration = activeSkipGeneration
                activeSkipGeneration =
                    previousActiveSkipGeneration === undefined
                        ? generation
                        : Math.max(previousActiveSkipGeneration, generation)

                try {
                    value.apply(this, args)
                } finally {
                    activeSkipGeneration = previousActiveSkipGeneration
                }
            })
        }

        return yieldingListener
    }

    let mostRecentWrapper: Function | undefined = wrapListener()

    Object.defineProperty(target, method, {
        enumerable: true,
        get() {
            return mostRecentWrapper
        },
        set(value) {
            if (DEBUG) console.log(`set ${String(method)}`, target, value)

            if (value === mostRecentWrapper) return
            mostRecentWrapper = value ? wrapListener(value as Function) : undefined
        },
    })
}

overrideListener(history, "pushState")
overrideListener(history, "replaceState")
overrideListener(HTMLFormElement.prototype, "submit")
