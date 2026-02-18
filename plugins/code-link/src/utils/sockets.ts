import {
    type CliToPluginMessage,
    getPortFromHash,
    isCliToPluginMessage,
    type ProjectInfo,
    shortProjectHash,
} from "@code-link/shared"
import { framer } from "framer-plugin"
import * as log from "./logger"

/**
 * Socket lifecycle controller for Code Link.
 *
 * - Keeps one active connection to the project-specific CLI port.
 * - Retries while visible; pauses when hidden after grace period.
 * - Resumes on focus/visibility changes in the Plugin window.
 * - Serializes inbound messages to avoid async race conditions.
 */
type LifecycleState = "created" | "active" | "paused" | "disposed"

type ResumeSource = "focus" | "visibilitychange"
type TimerName = "connectTrigger" | "connectTimeout" | "hiddenGrace"

export interface SocketConnectionController {
    start: () => void
    stop: () => void
}

export function createSocketConnectionController({
    project,
    setSocket,
    onMessage,
    onDisconnected,
}: {
    project: ProjectInfo
    setSocket: (socket: WebSocket | null) => void
    onMessage: (message: CliToPluginMessage, socket: WebSocket) => Promise<void>
    onDisconnected: (message: string) => void
}): SocketConnectionController {
    const RECONNECT_BASE_MS = 800
    const RECONNECT_MAX_MS = 5000
    const CONNECT_TIMEOUT_MS = 1200
    const HIDDEN_GRACE_MS = 10_000
    const WAKE_DEBOUNCE_MS = 300
    const DISCONNECTED_NOTICE_FAILURE_THRESHOLD = 2

    let lifecycle: LifecycleState = "created"
    let connectionAttempt = 0
    let failureCount = 0
    let socketToken = 0
    let hasNotifiedDisconnected = false
    let activeSocket: WebSocket | null = null
    let messageQueue: Promise<void> = Promise.resolve()
    const timers: Record<TimerName, ReturnType<typeof setTimeout> | null> = {
        connectTrigger: null,
        connectTimeout: null,
        hiddenGrace: null,
    }

    const projectName = project.name
    const projectShortHash = shortProjectHash(project.id)
    const port = getPortFromHash(project.id)

    const toDisconnectedMessage = () => {
        return `Cannot reach CLI for ${projectName} on port ${port}. Run: npx framer-code-link ${projectShortHash}`
    }

    const setLifecycle = (next: LifecycleState, reason: string) => {
        if (lifecycle === next) return
        log.debug("[connection] lifecycle transition", { from: lifecycle, to: next, reason })
        lifecycle = next
    }

    const isDisposed = () => lifecycle === "disposed"

    const clearTimer = (name: TimerName) => {
        const timer = timers[name]
        if (timer === null) return
        clearTimeout(timer)
        timers[name] = null
    }

    const setTimer = (name: TimerName, delay: number, callback: () => void) => {
        clearTimer(name)
        timers[name] = setTimeout(() => {
            timers[name] = null
            callback()
        }, delay)
    }

    const clearAllTimers = () => {
        clearTimer("connectTrigger")
        clearTimer("connectTimeout")
        clearTimer("hiddenGrace")
    }

    const socketIsActive = (socket: WebSocket | null) => {
        return socket?.readyState === WebSocket.CONNECTING || socket?.readyState === WebSocket.OPEN
    }

    const closeSocket = (socket: WebSocket) => {
        if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
            socket.close()
        }
    }

    const detachSocketHandlers = (socket: WebSocket) => {
        socket.onopen = null
        socket.onclose = null
        socket.onerror = null
        socket.onmessage = null
    }

    const setActiveSocket = (socket: WebSocket | null) => {
        activeSocket = socket
        setSocket(socket)
    }

    const computeBackoffDelay = () => {
        const exponent = Math.min(failureCount, 4)
        const base = Math.min(RECONNECT_BASE_MS * 2 ** exponent, RECONNECT_MAX_MS)
        const jitter = Math.floor(base * 0.2 * Math.random())
        return base - jitter
    }

    const startHiddenGracePeriod = () => {
        setTimer("hiddenGrace", HIDDEN_GRACE_MS, () => {
            if (isDisposed() || document.visibilityState === "visible") return
            if (socketIsActive(activeSocket)) return
            setLifecycle("paused", "hidden-grace-expired")
            clearTimer("connectTrigger")
        })
    }

    const scheduleConnect = (reason: string, delay: number) => {
        if (isDisposed() || lifecycle === "paused") return
        setLifecycle("active", `schedule:${reason}`)
        setTimer("connectTrigger", delay, () => {
            connect(reason, true)
        })
    }

    const scheduleReconnect = (reason: string, delay = computeBackoffDelay()) => {
        scheduleConnect(reason, delay)
    }

    const enqueueMessage = (message: CliToPluginMessage, socket: WebSocket) => {
        messageQueue = messageQueue
            .catch(() => {
                // Keep queue alive after prior handler failures.
            })
            .then(async () => {
                if (isDisposed()) return
                await onMessage(message, socket)
            })
            .catch((error: unknown) => {
                log.error("Unhandled error while processing WebSocket message:", error)
            })
    }

    const connect = (source: string, isRetry = false) => {
        if (isDisposed()) return
        if (lifecycle === "paused" && isRetry) return
        if (socketIsActive(activeSocket)) return

        const attempt = ++connectionAttempt
        setLifecycle("active", `connect:${source}${isRetry ? ":retry" : ""}`)

        const socket = new WebSocket(`ws://localhost:${port}`)
        const token = ++socketToken
        setActiveSocket(socket)

        setTimer("connectTimeout", CONNECT_TIMEOUT_MS, () => {
            if (isDisposed() || token !== socketToken) return
            if (socket.readyState === WebSocket.CONNECTING) {
                log.debug("WebSocket connect timeout - closing stale socket", {
                    port,
                    attempt,
                    timeoutMs: CONNECT_TIMEOUT_MS,
                })
                closeSocket(socket)
            }
        })

        const isStale = () => isDisposed() || token !== socketToken || activeSocket !== socket

        socket.onopen = async () => {
            clearTimer("connectTimeout")
            if (isStale()) {
                closeSocket(socket)
                return
            }

            failureCount = 0
            hasNotifiedDisconnected = false
            clearTimer("connectTrigger")
            clearTimer("hiddenGrace")
            setLifecycle("active", "socket-open")
            log.debug("WebSocket connected, sending handshake", { port, attempt, project: projectName })

            try {
                const latestProjectInfo = await framer.getProjectInfo()
                if (isStale() || socket.readyState !== WebSocket.OPEN) return
                socket.send(
                    JSON.stringify({
                        type: "handshake",
                        projectId: latestProjectInfo.id,
                        projectName: latestProjectInfo.name,
                    })
                )
            } catch (error) {
                log.warn("Failed to fetch project info for handshake:", error)
            }
        }

        socket.onmessage = event => {
            if (isStale()) return
            if (typeof event.data !== "string") {
                log.warn("Received non-text WebSocket payload, ignoring", {
                    payloadType: typeof event.data,
                })
                return
            }
            let parsed: unknown
            try {
                parsed = JSON.parse(event.data)
            } catch (error) {
                log.warn("Failed to parse WebSocket payload:", error)
                return
            }
            if (!isCliToPluginMessage(parsed)) {
                log.warn("Invalid message received:", parsed)
                return
            }
            enqueueMessage(parsed, socket)
        }

        socket.onerror = event => {
            if (isStale()) return
            log.debug("WebSocket error event", {
                type: event.type,
                port,
                attempt,
                project: projectName,
                failureCount,
            })
        }

        socket.onclose = event => {
            clearTimer("connectTimeout")
            if (isStale()) return

            setActiveSocket(null)
            failureCount += 1

            log.debug("WebSocket closed", {
                code: event.code,
                reason: event.reason || "none",
                wasClean: event.wasClean,
                port,
                attempt,
                project: projectName,
                failureCount,
            })

            if (
                !hasNotifiedDisconnected &&
                failureCount >= DISCONNECTED_NOTICE_FAILURE_THRESHOLD &&
                document.visibilityState === "visible"
            ) {
                hasNotifiedDisconnected = true
                onDisconnected(toDisconnectedMessage())
            }

            if (isDisposed()) return
            if (document.visibilityState === "visible") {
                scheduleReconnect("socket-close-visible")
                return
            }

            startHiddenGracePeriod()
            scheduleReconnect("socket-close-hidden", RECONNECT_BASE_MS)
        }
    }

    const hardResume = (source: ResumeSource) => {
        if (isDisposed()) return
        clearTimer("hiddenGrace")
        clearTimer("connectTrigger")
        setLifecycle("active", `resume:${source}`)

        if (activeSocket?.readyState === WebSocket.OPEN || activeSocket?.readyState === WebSocket.CONNECTING) {
            return
        }

        connect(`resume:${source}`)
    }

    const queueHardResume = (source: ResumeSource) => {
        setTimer("connectTrigger", WAKE_DEBOUNCE_MS, () => {
            hardResume(source)
        })
    }

    const onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
            queueHardResume("visibilitychange")
            return
        }
        clearTimer("connectTrigger")
        startHiddenGracePeriod()
    }

    const onFocus = () => {
        queueHardResume("focus")
    }

    return {
        start: () => {
            if (lifecycle !== "created") return
            setLifecycle("active", "start")

            document.addEventListener("visibilitychange", onVisibilityChange)
            window.addEventListener("focus", onFocus)

            if (document.visibilityState === "visible") {
                connect("start")
            } else {
                startHiddenGracePeriod()
            }
        },
        stop: () => {
            if (isDisposed()) return
            setLifecycle("disposed", "stop")

            document.removeEventListener("visibilitychange", onVisibilityChange)
            window.removeEventListener("focus", onFocus)

            clearAllTimers()
            const socket = activeSocket
            setActiveSocket(null)

            if (socket) {
                detachSocketHandlers(socket)
                closeSocket(socket)
            }
        },
    }
}
