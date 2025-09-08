/* eslint-disable @typescript-eslint/no-unnecessary-condition,@typescript-eslint/no-unsafe-function-type */
"use strict"

// turns on override logs
const DEBUG = false

/** A set to keep track of all unresolved yield promises */
const pendingResolvers = new Set<VoidFunction>()
const pendingAnimationFrameCallbacks = new Set<VoidFunction>()
let animationFrameScheduled = false

function resolveAnimationFrameCallbacks() {
    animationFrameScheduled = false
    for (const callback of pendingAnimationFrameCallbacks) {
        callback()
    }
    pendingAnimationFrameCallbacks.clear()
}

function queueAfterPaintCallback(callback: VoidFunction) {
    pendingAnimationFrameCallbacks.add(callback)

    // Scheduling tasks can be relatively expensive, so we batch rAFs & timeouts/yields together.
    if (animationFrameScheduled) return
    animationFrameScheduled = true
    requestAnimationFrame(resolveAnimationFrameCallbacks)
}

/** Resolves all unresolved yield promises and clears the set. */
function resolvePendingPromises() {
    for (const resolve of pendingResolvers) resolve()
    pendingResolvers.clear()
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

async function queueYieldCallback(resolve: VoidFunction, shouldWaitForLoad: boolean) {
    pendingResolvers.add(resolve)

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

    const callback = () => {
        lowPriorityCallback(() => {
            if (DEBUG)
                // @ts-expect-error TS(2554): TS doesn't know about the new syntax yet
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                console.timeStamp(`yield-${timeStamp}`, timeStamp, performance.now(), "GTM yield", "GTM yield")

            pendingResolvers.delete(resolve)
            resolve()
        })
    }

    queueAfterPaintCallback(() => {
        if (isInputPending()) {
            // Input is pending, so let's wait for the next paint afterwards.
            queueAfterPaintCallback(callback)
        } else {
            callback()
        }
    })
}

/**
 * This is a modified `yieldUnlessUrgent` tailored to the GTM optimization use-case.
 * The difference is, we batch calls to `requestAnimationFrame` manually and only support lowest priority
 * (`setTimeout(fn, 1)`/postTask background priority)
 */
async function yieldUnlessUrgent(shouldWaitForLoad = false) {
    if (document.hidden) {
        resolvePendingPromises()
        return
    }

    return new Promise<void>(resolve => {
        void queueYieldCallback(resolve, shouldWaitForLoad)
    })
}

let globalWaitingForClickPromise: Promise<void> | undefined
let globalWaitingForClickResolve: (() => void) | undefined

async function getPromiseWithFallback() {
    return new Promise<void>(resolve => {
        const resolveFn = () => {
            pendingResolvers.delete(resolve)
            resolve()
        }

        globalWaitingForClickResolve = resolveFn

        // Safety fallback in case `click` never fires, where 150ms ensures the delay isn't noticeable by users
        // TODO: Add a log here when `yieldOnTap` ships to stable, so we understand how often this occurs.
        setTimeout(resolveFn, 150)
        pendingResolvers.add(resolve) // Ensure we resolve when the page becomes hidden
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
interface CloneEvent extends Event {
    __originalEvent: Event
}

function cloneEvent(event: Event): CloneEvent {
    // @ts-expect-error TS(2339): We already cloned this event
    if (event.__originalEvent) return event

    // @ts-expect-error TS(2351): TS doesn't know that event.constructor is a function
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const newEvent = new event.constructor(event.type, event) as CloneEvent

    // the following need to be set to read-only or they get overridden when dispatching
    const keysToDefine = ["target", "srcElement", "offsetX", "offsetY", "layerX", "layerY", "toElement"] as const
    for (const key of keysToDefine) {
        if (key in event) {
            Object.defineProperty(newEvent, key, {
                writable: false, // Needed to prevent write, else this gets overridden when dispatching.
                value: event[key as keyof Event],
            })
        }
    }

    newEvent.__originalEvent = event

    if (DEBUG) {
        console.log(event, newEvent)
        const readOnlyProps = [
            "__originalEvent",
            "isTrusted",
            "currentTarget",
            "eventPhase",
            "defaultPrevented",
            "composed",
            "timeStamp",
            "bubbles",
            "cancelable",
            "cancelBubble",
        ]
        const differentProps: string[] = []
        const missingProps: string[] = []
        let prop: keyof Event
        for (prop in event) {
            if (typeof event[prop] === "function" || readOnlyProps.includes(prop)) continue

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

    return newEvent
}

// #region capturing listener interceptor
// Intercept event listeners during capture phase.
// eslint-disable-next-line @typescript-eslint/unbound-method
const originalAddEventListener = document.addEventListener
const typesToIntercept = ["click", "auxclick", "mousedown", "keyup", "submit"] as const
type EventType = (typeof typesToIntercept)[number]

document.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options: boolean | AddEventListenerOptions | undefined
) {
    if (
        typesToIntercept.includes(type as EventType) &&
        (options === true || (typeof options === "object" && options.capture))
    ) {
        if (DEBUG) console.log(`Overriding ${type} listener`, listener)

        originalAddEventListener.call(
            this,
            type,
            async function overriddenEventListener(this: unknown, e) {
                // @ts-expect-error TS(2339): Used to skip events that have already been handled by the bubble phase interceptor.
                if (e.__f) return

                const event = cloneEvent(e) // Clone at the time of interception

                if (
                    event.type === "mousedown" &&
                    (event as unknown as MouseEvent).button === 0 /* primary / left mouse button */
                ) {
                    await globalWaitingForClickPromise
                }

                await yieldUnlessUrgent()

                if (typeof listener === "function") {
                    listener.call(this, event)
                } else {
                    listener.handleEvent(event)
                }
            },
            options
        )
        return
    }

    // If not capturing, we can just call the original addEventListener function
    originalAddEventListener.call(this, type, listener, options)
}

// #region body interceptor
// readystatechange runs exactly before DOMContentLoaded, which is needed to ensure we call stopPropagation early (first
// listener added runs first)
// This runs at the bubble phase.
document.addEventListener("readystatechange", () => {
    if (document.readyState !== "interactive") return

    const body = document.body
    async function interceptEvent(e: Event) {
        e.stopPropagation()

        const event = cloneEvent(e) // Clone at the time of interception

        if (
            event.type === "mousedown" &&
            (event as unknown as MouseEvent).button === 0 /* primary / left mouse button */
        ) {
            await globalWaitingForClickPromise
        }

        await yieldUnlessUrgent()

        // @ts-expect-error TS(2339): Used to mark the event as having been handled by the bubble phase interceptor.
        event.__f = true
        // We don't dispatch at the body, so that non-capturing event listeners don't receive the event twice.
        document.dispatchEvent(event)
    }

    // Intercept `document` level listeners that are not capturing.
    for (const element of typesToIntercept) {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        body.addEventListener(element, interceptEvent)
    }
})

// #region GTM override
function wrapDataLayerPush(push: DataLayer["push"]) {
    // Must be a (non-async) function, not an arrow function, because we need to bind the original `this` context
    // the GTM dataLayer push function returns `true` if the push was successful, we just assume it is.
    // The `...args` spread is needed so the call results in the exactly same result as the original.
    // The function syntax is important here so we keep the correct `this`.
    return function yieldingPush(this: DataLayer, ...args: object[]) {
        void yieldUnlessUrgent(true).then(() => {
            // The arrow FN is important here so we keep the correct `this`.
            push.apply(this, args)
        })
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
function callOriginalMethod(
    this: unknown,
    originalMethod: Function,
    args: unknown[],
    callIfFirstArgIsntObject = false
) {
    const firstArg = args[0] ?? this

    const argIsObject = firstArg != null && typeof firstArg === "object"

    if (argIsObject && !("__f" in firstArg)) {
        originalMethod.apply(this, args)

        // @ts-expect-error TS(2339): Flag to indicate that the native method was called
        firstArg.__f = true
    } else if (!argIsObject && callIfFirstArgIsntObject) {
        // If for some reason, we haven't called the original method yet, we call it here.
        originalMethod.apply(this, args)
    }
}

function wrapListener(originalMethod: Function, value: Function) {
    // the function syntax is important here so we keep the correct `this`.
    return function yieldingListener(this: unknown, ...args: [data: object, ...args: unknown[]]) {
        if (DEBUG) {
            console.log("Yielding for", originalMethod)
            console.timeStamp(originalMethod as unknown as string)
        }

        // We first call the original: This optimizes for UX & correctness of React components.
        // e.g., for pushState, when a component renders on a new route, it might set state and/or read from the URL. If the URL isn't
        // accurate, it might lead to wrong behavior.
        // We don't want to call the underlying native method twice (or multiple times), so we add a
        // flag to the data object or `this`.
        callOriginalMethod.call(this, originalMethod, args)

        // If `method` is overriden N times, it creates N yield points (as overrides might be chained)
        void yieldUnlessUrgent().then(() => {
            // The arrow FN is important here so we keep the correct `this`.
            value.apply(this, args)
        })
    }
}
function overrideListener<T extends object>(target: T, method: keyof T) {
    // @ts-expect-error TS(2339): Prototype chain call. We try __proto__ first, as this will usually be the original method.
    const originalMethod: Function = (target.__proto__ as unknown as T)[method] ?? (target[method] as Function)

    let mostRecentWrapper: Function | undefined = wrapListener(
        originalMethod,
        // The function syntax is important here so we keep the correct `this`.
        function firstOverride(this: unknown, ...args: [data: object, ...args: unknown[]]) {
            callOriginalMethod.call(this, originalMethod, args, true)
        }
    )

    Object.defineProperty(target, method, {
        enumerable: true,
        get() {
            return mostRecentWrapper
        },
        set(value) {
            if (DEBUG) console.log(`set ${String(method)}`, target, value)

            if (value === mostRecentWrapper) return
            mostRecentWrapper = value ? wrapListener(originalMethod, value as Function) : undefined
        },
    })
}

overrideListener(history, "pushState")
overrideListener(history, "replaceState")
overrideListener(HTMLFormElement.prototype, "submit")
