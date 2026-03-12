import { CLOSE_CODE_REPLACED, type ProjectInfo } from "@code-link/shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createSocketConnectionController } from "./sockets.ts"

vi.mock("framer-plugin", () => ({
    framer: {
        getProjectInfo: vi.fn(async () => ({ id: "project-id", name: "Project Name" })),
    },
}))

class MockEventTarget {
    private listeners = new Map<string, Set<EventListener>>()

    addEventListener = vi.fn((type: string, listener: EventListener) => {
        const listenersForType = this.listeners.get(type) ?? new Set<EventListener>()
        listenersForType.add(listener)
        this.listeners.set(type, listenersForType)
    })

    removeEventListener = vi.fn((type: string, listener: EventListener) => {
        this.listeners.get(type)?.delete(listener)
    })

    dispatch(type: string) {
        for (const listener of this.listeners.get(type) ?? []) {
            listener(new Event(type))
        }
    }
}

class MockWebSocket {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSING = 2
    static readonly CLOSED = 3
    static instances: MockWebSocket[] = []

    readonly url: string
    readyState = MockWebSocket.CONNECTING
    onopen: ((event: Event) => void) | null = null
    onclose: ((event: CloseEventLike) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    send = vi.fn()

    constructor(url: string) {
        this.url = url
        MockWebSocket.instances.push(this)
    }

    close(code = 1000, reason = "") {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.({ code, reason, wasClean: true })
    }

    emitClose(code = 1000, reason = "") {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.({ code, reason, wasClean: true })
    }
}

interface CloseEventLike {
    code: number
    reason: string
    wasClean: boolean
}

describe("createSocketConnectionController", () => {
    const originalDocument = globalThis.document
    const originalWindow = globalThis.window
    const originalWebSocket = globalThis.WebSocket
    let mockDocument: MockEventTarget & { visibilityState: DocumentVisibilityState }
    let mockWindow: MockEventTarget

    beforeEach(() => {
        vi.useFakeTimers()
        MockWebSocket.instances = []

        mockDocument = Object.assign(new MockEventTarget(), {
            visibilityState: "visible" as DocumentVisibilityState,
        })
        Object.defineProperty(mockDocument, "visibilityState", {
            value: "visible",
            configurable: true,
            writable: true,
        })

        mockWindow = new MockEventTarget()

        globalThis.document = mockDocument as unknown as Document
        globalThis.window = mockWindow as unknown as Window & typeof globalThis
        globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        globalThis.document = originalDocument
        globalThis.window = originalWindow
        globalThis.WebSocket = originalWebSocket
    })

    it("cleans up listeners and timers after a replaced close followed by stop", () => {
        const setSocket = vi.fn()
        const onReplaced = vi.fn()

        const controller = createSocketConnectionController({
            project: { id: "project-id", name: "Project Name" } satisfies ProjectInfo,
            setSocket,
            onMessage: vi.fn(async () => {}),
            onConnected: vi.fn(),
            onDisconnected: vi.fn(),
            onReplaced,
        })

        controller.start()

        expect(mockDocument.addEventListener).toHaveBeenCalledWith(
            "visibilitychange",
            expect.any(Function)
        )
        expect(mockWindow.addEventListener).toHaveBeenCalledWith("focus", expect.any(Function))
        expect(MockWebSocket.instances).toHaveLength(1)

        mockWindow.dispatch("focus")
        expect(vi.getTimerCount()).toBe(2)

        MockWebSocket.instances[0]?.emitClose(CLOSE_CODE_REPLACED, "replaced")
        controller.stop()

        expect(onReplaced).toHaveBeenCalledOnce()
        expect(mockDocument.removeEventListener).toHaveBeenCalledWith(
            "visibilitychange",
            expect.any(Function)
        )
        expect(mockWindow.removeEventListener).toHaveBeenCalledWith("focus", expect.any(Function))
        expect(vi.getTimerCount()).toBe(0)
        expect(setSocket).toHaveBeenLastCalledWith(null)
    })
})
