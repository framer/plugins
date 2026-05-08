/**
 * Cross-component integration tests for start(): connection + handshake + watcher + state machine.
 * Uses real tempdir FS, fake WebSocket surface, mocked TLS/certs and mocked initConnection server.
 */

import { CLOSE_CODE_REPLACED, type PluginToCliMessage, shortProjectHash } from "@code-link/shared"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Config, WatcherEvent } from "./types.ts"

const { harness, initWatcherMock, emitWatcherChange } = vi.hoisted(() => {
    const READY_STATE = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 } as const

    type FakeWs = {
        readyState: number
        sent: string[]
        lastCloseCode?: number
        receive: (msg: PluginToCliMessage) => void
        send: (data: string | Buffer, cb?: (err?: Error | null) => void) => void
        close: (code?: number) => void
    }

    const handlers: Partial<{
        handshake: (client: FakeWs, message: { projectId: string; projectName: string }) => void
        message: (message: PluginToCliMessage) => void
        disconnect: (client: FakeWs) => void
    }> = {}

    let activeClient: FakeWs | null = null
    let connectionId = 0

    function createFakeWs(): FakeWs {
        const ws: FakeWs = {
            readyState: READY_STATE.OPEN,
            sent: [],
            receive(msg: PluginToCliMessage) {
                try {
                    if (msg.type === "handshake") {
                        connectionId += 1
                        const connId = connectionId
                        const previousActiveClient = activeClient
                        activeClient = ws
                        if (previousActiveClient && previousActiveClient !== activeClient) {
                            if (
                                previousActiveClient.readyState === READY_STATE.OPEN ||
                                previousActiveClient.readyState === READY_STATE.CONNECTING
                            ) {
                                previousActiveClient.close(CLOSE_CODE_REPLACED)
                            }
                        }
                        handlers.handshake?.(ws, msg)
                    } else if (activeClient === ws) {
                        handlers.message?.(msg)
                    } else {
                        // stale client — matches connection.ts ignoring non-handshake from stale
                    }
                } catch {
                    /* ignore parse errors in test */
                }
            },
            send(data, cb) {
                const s = typeof data === "string" ? data : data.toString()
                this.sent.push(s)
                cb?.(null)
            },
            close(code = 1000) {
                this.lastCloseCode = code
                if (this.readyState === READY_STATE.CLOSED) return
                this.readyState = READY_STATE.CLOSED
                if (activeClient === ws) {
                    activeClient = null
                    handlers.disconnect?.(ws)
                }
            },
        }
        return ws
    }

    const changeHandlers: Array<(e: WatcherEvent) => void> = []
    const initWatcherMock = vi.fn((_filesDir: string) => ({
        on(_event: "change", handler: (e: WatcherEvent) => void) {
            changeHandlers.push(handler)
        },
        close: vi.fn(() => Promise.resolve()),
    }))

    function emitWatcherChange(event: WatcherEvent) {
        for (const h of changeHandlers) {
            h(event)
        }
    }

    async function initConnection(_port: number, _certs: { key: string; cert: string }) {
        return {
            on(event: "handshake" | "message" | "disconnect", handler: (typeof handlers)[typeof event]) {
                if (event === "handshake") handlers.handshake = handler as typeof handlers.handshake
                if (event === "message") handlers.message = handler as typeof handlers.message
                if (event === "disconnect") handlers.disconnect = handler as typeof handlers.disconnect
            },
            close: vi.fn(),
        }
    }

    function sendMessage(socket: FakeWs, message: import("@code-link/shared").CliToPluginMessage): Promise<boolean> {
        return new Promise(resolve => {
            if (socket.readyState !== READY_STATE.OPEN) {
                resolve(false)
                return
            }
            socket.send(JSON.stringify(message), () => resolve(true))
        })
    }

    return {
        harness: {
            createFakeWs,
            handlers,
            get activeClient() {
                return activeClient
            },
            initConnection,
            sendMessage,
            reset() {
                handlers.handshake = undefined
                handlers.message = undefined
                handlers.disconnect = undefined
                activeClient = null
                changeHandlers.length = 0
                initWatcherMock.mockClear()
            },
        },
        initWatcherMock,
        emitWatcherChange,
    }
})

vi.mock("./helpers/certs.ts", () => ({
    getOrCreateCerts: vi.fn(() => Promise.resolve({ key: "test-key", cert: "test-cert" })),
    CERT_DIR: "/tmp",
}))

vi.mock("./helpers/connection.ts", () => ({
    initConnection: harness.initConnection,
    sendMessage: harness.sendMessage,
}))

vi.mock("./helpers/watcher.ts", () => ({
    initWatcher: initWatcherMock,
}))

vi.mock("./helpers/installer.ts", () => ({
    Installer: class {
        initialize = vi.fn(() => Promise.resolve())
        process = vi.fn()
        constructor(_opts: unknown) {}
    },
}))

vi.mock("./helpers/git.ts", () => ({
    tryGitInit: vi.fn(),
}))

async function loadStart() {
    const { start } = await import("./controller.ts")
    return start
}

describe("start() integration", () => {
    let tmpDir: string

    beforeEach(() => {
        harness.reset()
    })

    afterEach(async () => {
        if (tmpDir) {
            await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
        }
    })

    function baseConfig(projectHash: string): Config {
        return {
            port: 42_000,
            projectHash,
            projectDir: null,
            filesDir: null,
            dangerouslyAutoDelete: true,
            once: false,
            explicitDirectory: tmpDir,
            explicitName: "TestProject",
        }
    }

    it("replaces active socket with CLOSE_CODE_REPLACED when a second client handshakes", async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-int-"))
        const projectHash = "integration-test-project-hash-12345"
        const start = await loadStart()
        await start(baseConfig(projectHash))

        const id = shortProjectHash(projectHash)
        const ws1 = harness.createFakeWs()
        ws1.receive({ type: "handshake", projectId: id, projectName: "P1" })
        await vi.waitFor(() => expect(harness.activeClient).toBe(ws1))

        const ws2 = harness.createFakeWs()
        ws2.receive({ type: "handshake", projectId: id, projectName: "P2" })
        await vi.waitFor(() => expect(harness.activeClient).toBe(ws2))

        expect(ws1.readyState).toBe(3)
        expect(ws1.lastCloseCode).toBe(CLOSE_CODE_REPLACED)
    })

    it("emits sync-status initial_sync then ready only after SYNC_COMPLETE effects", async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-int-"))
        const projectHash = "integration-sync-status-789"
        const start = await loadStart()
        await start(baseConfig(projectHash))

        const id = shortProjectHash(projectHash)
        const ws = harness.createFakeWs()
        ws.receive({ type: "handshake", projectId: id, projectName: "P" })
        await vi.waitFor(() =>
            expect(
                ws.sent.some(payload => {
                    const message = JSON.parse(payload) as { type?: string; status?: string }
                    return message.type === "sync-status" && message.status === "initial_sync"
                })
            ).toBe(true)
        )
        await vi.waitFor(() => expect(initWatcherMock).toHaveBeenCalled(), { timeout: 5000 })

        ws.receive({ type: "request-files" })
        await vi.waitFor(() => ws.sent.some(s => JSON.parse(s).type === "file-list"))

        ws.receive({ type: "file-list", files: [] })
        await vi.waitFor(() => {
            const phases = ws.sent
                .map(payload => JSON.parse(payload) as { type?: string; status?: string })
                .filter(message => message.type === "sync-status")
                .map(message => message.status)

            const idxInitial = phases.indexOf("initial_sync")
            const idxReady = phases.indexOf("ready")
            expect(idxInitial).toBeGreaterThanOrEqual(0)
            expect(idxReady).toBeGreaterThan(idxInitial)
        })
    })

    it("ignores watcher change events while snapshot_processing (during detectConflicts)", async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-int-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })
        await fs.writeFile(path.join(filesDir, "A.tsx"), "export const A = 1", "utf-8")

        const filesMod = await import("./helpers/files.ts")
        const orig = filesMod.detectConflicts
        const spy = vi.spyOn(filesMod, "detectConflicts").mockImplementation(async (remoteFiles, filesDirArg, opts) => {
            emitWatcherChange({ kind: "change", relativePath: "A.tsx", content: "export const A = 2" })
            return orig(remoteFiles, filesDirArg, opts)
        })

        const projectHash = "integration-watcher-snap-123"
        const start = await loadStart()
        await start(baseConfig(projectHash))

        const id = shortProjectHash(projectHash)
        const ws = harness.createFakeWs()
        ws.receive({ type: "handshake", projectId: id, projectName: "P" })
        await vi.waitFor(() => expect(initWatcherMock).toHaveBeenCalled(), { timeout: 5000 })

        ws.receive({ type: "request-files" })
        await vi.waitFor(() => ws.sent.some(s => JSON.parse(s).type === "file-list"))

        ws.receive({
            type: "file-list",
            files: [{ name: "A.tsx", content: "export const A = 1", modifiedAt: Date.now() }],
        })

        await vi.waitFor(() => {
            const hasFileChange = ws.sent.some(s => {
                try {
                    const m = JSON.parse(s) as { type?: string }
                    return m.type === "file-change"
                } catch {
                    return false
                }
            })
            expect(hasFileChange).toBe(false)
        })

        spy.mockRestore()
    })

    it("processes queued remote file changes after snapshot follow-ups finish", async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-int-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })
        await fs.writeFile(path.join(filesDir, "A.tsx"), "export const A = 1", "utf-8")

        let ws: ReturnType<typeof harness.createFakeWs> | null = null
        const filesMod = await import("./helpers/files.ts")
        const orig = filesMod.detectConflicts
        const spy = vi.spyOn(filesMod, "detectConflicts").mockImplementation(async (remoteFiles, filesDirArg, opts) => {
            if (!ws) throw new Error("Expected websocket before detectConflicts")
            ws.receive({
                type: "file-change",
                fileName: "A.tsx",
                content: "export const A = 2",
            })
            return orig(remoteFiles, filesDirArg, opts)
        })

        const projectHash = "integration-remote-snap-123"
        const start = await loadStart()
        await start(baseConfig(projectHash))

        const id = shortProjectHash(projectHash)
        ws = harness.createFakeWs()
        ws.receive({ type: "handshake", projectId: id, projectName: "P" })
        await vi.waitFor(() => expect(initWatcherMock).toHaveBeenCalled(), { timeout: 5000 })

        ws.receive({
            type: "file-list",
            files: [{ name: "A.tsx", content: "export const A = 1", modifiedAt: Date.now() }],
        })

        await vi.waitFor(async () => {
            expect(await fs.readFile(path.join(filesDir, "A.tsx"), "utf-8")).toBe("export const A = 2")
        })

        spy.mockRestore()
    })

    it("survives disconnect during conflict resolution and accepts a new handshake", async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-int-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })
        await fs.writeFile(path.join(filesDir, "C.tsx"), "local", "utf-8")

        const projectHash = "integration-conflict-reconnect-456"
        const start = await loadStart()
        await start(baseConfig(projectHash))

        const id = shortProjectHash(projectHash)
        const ws = harness.createFakeWs()
        ws.receive({ type: "handshake", projectId: id, projectName: "P" })
        await vi.waitFor(() => expect(initWatcherMock).toHaveBeenCalled(), { timeout: 5000 })

        ws.receive({ type: "request-files" })
        await vi.waitFor(() => ws.sent.some(s => JSON.parse(s).type === "file-list"))

        ws.receive({
            type: "file-list",
            files: [{ name: "C.tsx", content: "remote", modifiedAt: Date.now() }],
        })

        await vi.waitFor(() => ws.sent.some(s => JSON.parse(s).type === "conflict-version-request"))

        ws.close(1000)

        await vi.waitFor(() => expect(harness.activeClient).toBeNull())

        const ws2 = harness.createFakeWs()
        ws2.receive({ type: "handshake", projectId: id, projectName: "P" })
        await vi.waitFor(() => expect(harness.activeClient).toBe(ws2))
    })

    it("ignores stale delete confirmations after reconnect", async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-int-"))
        const projectHash = "integration-stale-delete-789"
        const start = await loadStart()
        await start(baseConfig(projectHash))

        const id = shortProjectHash(projectHash)
        const ws1 = harness.createFakeWs()
        ws1.receive({ type: "handshake", projectId: id, projectName: "P" })
        await vi.waitFor(() => expect(initWatcherMock).toHaveBeenCalled(), { timeout: 5000 })

        const filePath = path.join(tmpDir, "files", "Ghost.tsx")
        const content = "export const Ghost = 1"
        await fs.writeFile(filePath, content, "utf-8")

        ws1.close(1000)
        await vi.waitFor(() => expect(harness.activeClient).toBeNull())

        const ws2 = harness.createFakeWs()
        ws2.receive({ type: "handshake", projectId: id, projectName: "P" })
        await vi.waitFor(() => expect(harness.activeClient).toBe(ws2))

        ws2.receive({
            type: "delete-confirmed",
            fileNames: ["Ghost.tsx"],
            session: { connectionId: 0, promptId: "stale" },
        })

        await vi.waitFor(async () => {
            expect(await fs.readFile(filePath, "utf-8")).toBe(content)
        })
    })

    it("clears pending delete prompts when replacing the active socket", async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-int-"))
        const projectHash = "integration-replace-delete-prompt-123"
        const start = await loadStart()
        await start({ ...baseConfig(projectHash), dangerouslyAutoDelete: false })

        const id = shortProjectHash(projectHash)
        const ws1 = harness.createFakeWs()
        ws1.receive({ type: "handshake", projectId: id, projectName: "P" })
        await vi.waitFor(() => expect(initWatcherMock).toHaveBeenCalled(), { timeout: 5000 })
        ws1.receive({ type: "file-list", files: [] })
        await vi.waitFor(() =>
            ws1.sent.some(s => JSON.parse(s).type === "sync-status" && JSON.parse(s).status === "ready")
        )

        emitWatcherChange({ kind: "delete", relativePath: "A.tsx" })
        await vi.waitFor(() =>
            expect(ws1.sent.some(s => JSON.parse(s).type === "file-delete" && JSON.parse(s).mode === "confirm")).toBe(
                true
            )
        )

        const ws2 = harness.createFakeWs()
        ws2.receive({ type: "handshake", projectId: id, projectName: "P" })
        await vi.waitFor(() =>
            expect(
                ws2.sent.some(s => JSON.parse(s).type === "sync-status" && JSON.parse(s).status === "initial_sync")
            ).toBe(true)
        )
        ws2.receive({ type: "file-list", files: [] })
        await vi.waitFor(() =>
            ws2.sent.some(s => JSON.parse(s).type === "sync-status" && JSON.parse(s).status === "ready")
        )

        ws2.sent.length = 0
        emitWatcherChange({ kind: "delete", relativePath: "A.tsx" })

        await vi.waitFor(() =>
            expect(ws2.sent.some(s => JSON.parse(s).type === "file-delete" && JSON.parse(s).mode === "confirm")).toBe(
                true
            )
        )
    })
})
