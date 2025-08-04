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

/**
 * This is a modified `yieldUnlessUrgent` tailored to the GTM optimization use-case.
 * The difference is, we batch calls to `requestAnimationFrame` manually and only support lowest priority (`setTimeout(fn, 1)`)
 */
async function yieldUnlessUrgent(shouldWaitForLoad = false) {
    if (document.hidden) {
        resolvePendingPromises()
        return
    }

    if (shouldWaitForLoad && document.readyState !== "complete") {
        await new Promise<void>(resolve => {
            document.addEventListener("load", () => {
                resolve()
            })
        })
    }

    return new Promise<void>(resolve => {
        pendingResolvers.add(resolve)

        // await next paint without a setTimeout fallback, as the fallbacks are the event listeners above
        queueAfterPaintCallback(() => {
            setTimeout(() => {
                pendingResolvers.delete(resolve)
                resolve()
            }, 1)
        })
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
document.addEventListener("visibilitychange", globalClickReceivedListener)
document.addEventListener("pagehide", globalClickReceivedListener)

type DataLayerPush = (...items: object[]) => boolean
type DataLayer = Omit<object[], "push"> & {
    push: DataLayerPush
    __f?: boolean // flag to indicate if the push function has been overridden
}

function cloneEvent(event: Event) {
    // @ts-expect-error TS(2339): We already cloned this event
    if (event.__originalEvent) return event

    // @ts-expect-error TS(2351): TS doesn't know that event.constructor is a function
    const newEvent = new event.constructor(event.type, event)

    // the following need to be set to read-only or they get overridden when dispatching
    const keysToDefine = ["target", "srcElement", "offsetX", "offsetY", "layerX", "layerY", "toElement"] as const
    for (const key of keysToDefine) {
        if (key in event) {
            Object.defineProperty(newEvent, key, {
                writable: false, // Neededed to prevent write, else this gets overridden when dispatching.
                value: event[key as keyof Event],
            })
        }
    }

    newEvent.__originalEvent = event

    if (DEBUG) {
        // biome-ignore lint/suspicious/noConsole: debug
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
            if (newEvent[prop] === undefined) {
                missingProps.push(prop)
            } else if (event[prop] !== newEvent[prop]) {
                differentProps.push(prop)
            }
        }
        if (differentProps.length || missingProps.length) {
            // biome-ignore lint/suspicious/noConsole: debug
            console.log(`Different: ${differentProps.join(", ")}`, `Missing: ${missingProps.join(", ")}`)
        }
    }

    return newEvent
}

// #region capturing listener interceptor
// Intercept capturing event listeners:
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
        // biome-ignore lint/suspicious/noConsole: debug
        if (DEBUG) console.log(`Overriding ${type} listener`, listener)

        // Note: This listener also receives dispatches from our document.body interceptor.
        // This means, sometimes it might yield twice. This is ok, as it can potentially split
        // 3rd-party-listeners across multiple frames.
        // Tiny "TODO": We could explicitly 'waterfall' those listeners:
        // yield -> schedule next task -> yield -> schedule next task instead of
        // yield -> all run in one task
        originalAddEventListener.call(
            this,
            type,
            async function overriddenEventListener(this: unknown, e) {
                const event = cloneEvent(e) // Clone at the time of interception

                if (event.type === "mousedown" && event.button === 0 /* primary / left mouse button */) {
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
// readystatechange runs exactly before DOMContentLoaded, which is needed to ensure we call stopPropagation early (first listener added runs first)
document.addEventListener("readystatechange", () => {
    if (document.readyState !== "interactive") return

    const body = document.body
    async function interceptEvent(e: Event) {
        e.stopPropagation()

        const event = cloneEvent(e) // Clone at the time of interception

        if (event.type === "mousedown" && event.button === 0 /* primary / left mouse button */) {
            await globalWaitingForClickPromise
        }

        await yieldUnlessUrgent()
        document.dispatchEvent(event)
    }

    // Intercept `document` level listeners that are not capturing.
    for (const element of typesToIntercept) {
        body.addEventListener(element, interceptEvent)
    }
})

// #region GTM override
function wrapDataLayerPush(push: DataLayer["push"], dataLayer: DataLayer) {
    // Must be a (non-async) function, not an arrow function, because we need to bind the original `this` context
    // the GTM dataLayer push function returns `true` if the push was successful, we just assume it is.
    // The `...args` spread is needed so the call results in the exactly same result as the original.
    return function yieldingPush(...args: object[]) {
        void yieldUnlessUrgent(true).then(function innerPush() {
            // In case we override the native Array#push here, we need to set the original array as `this` to not cause runtime errors
            push.apply(dataLayer, args)
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
            // biome-ignore lint/suspicious/noConsole: debug
            if (DEBUG) console.log("set dataLayer.push", value)

            if (value === mostRecentPushWrapper) return // skip for `window.dataLayer = window.dataLayer||[]`
            mostRecentPushWrapper = value ? wrapDataLayerPush(value, dataLayer) : undefined
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
            // biome-ignore lint/suspicious/noConsole: debug
            if (DEBUG) console.log("set dataLayer", value)

            if (value === mostRecentDataLayerWrapper) return // skip for `window.dataLayer = window.dataLayer||[]`
            mostRecentDataLayerWrapper = value
            if (mostRecentDataLayerWrapper) {
                defineCustomDataLayerPush(mostRecentDataLayerWrapper)
            }
        },
    })
}

document.addEventListener("framer:overrideGTM", overrideGTMDataLayer, { once: true })

// #region History wrapper override
function wrapHistory(method: "pushState" | "replaceState", value: (typeof window.history)[typeof method]) {
    return (...args: Parameters<(typeof window.history)[typeof method]>) => {
        // We first call the original pushState: This optimizes for UX & correctness of React components.
        // e.g., when a component renders on a new route, it might set state and/or read from the URL. If the URL isn't
        // accurate, it might lead to wrong behavior.
        // We don't want to call the underlying native method twice (or multiple times), so we add a
        // flag to the data object.
        if (!("__f" in args[0])) {
            // @ts-expect-error TS(2339): Prototype chain call.
            window.history.__proto__[method].apply(window.history, args)
            args[0].__f = true // flag to indicate that the native method was called
        }

        void yieldUnlessUrgent().then(() => {
            value.apply(window.history, args)
        })
    }
}
function overrideHistory(method: "pushState" | "replaceState") {
    // The initial value is a noop, so that the first override doesn't call the native method.
    // We still need to set it to a function, so that the `get` function returns a function that is
    // used if nothing ever overrides it.
    let mostRecentHistoryWrapper: (typeof window.history)[typeof method] | undefined = wrapHistory(method, () => {})

    Object.defineProperty(window.history, method, {
        enumerable: true,
        get() {
            return mostRecentHistoryWrapper
        },
        set(value) {
            // biome-ignore lint/suspicious/noConsole: debug
            if (DEBUG) console.log(`set history.${method}`, value)

            if (value === mostRecentHistoryWrapper) return
            mostRecentHistoryWrapper = value ? wrapHistory(method, value) : undefined
        },
    })
}

overrideHistory("pushState")
overrideHistory("replaceState")
