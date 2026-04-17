import { beforeEach, describe, expect, it, vi } from "vitest"
import type { WebSocket } from "ws"
import { executeEffect } from "./controller.ts"
import { SyncKernel } from "./kernel.ts"
import type { Config } from "./types.ts"

const { sendMessage, status, success, tryGitInit, wasRecentlyDisconnected, didShowDisconnect, resetDisconnectState } =
    vi.hoisted(() => ({
        sendMessage: vi.fn(),
        status: vi.fn(),
        success: vi.fn(),
        tryGitInit: vi.fn(),
        wasRecentlyDisconnected: vi.fn(),
        didShowDisconnect: vi.fn(),
        resetDisconnectState: vi.fn(),
    }))

vi.mock("./helpers/connection.ts", () => ({
    initConnection: vi.fn(),
    sendMessage,
}))

vi.mock("./helpers/git.ts", () => ({
    tryGitInit,
}))

vi.mock("./utils/logging.ts", async importOriginal => {
    const actual = await importOriginal<typeof import("./utils/logging.ts")>()

    return {
        ...actual,
        status,
        success,
        wasRecentlyDisconnected,
        didShowDisconnect,
        resetDisconnectState,
    }
})

const mockSocket = {} as WebSocket

function createConfig(overrides: Partial<Config> = {}): Config {
    return {
        port: 0,
        projectHash: "project",
        projectDir: "/tmp/project",
        filesDir: "/tmp/project/files",
        dangerouslyAutoDelete: false,
        allowUnsupportedNpm: false,
        ...overrides,
    }
}

describe("SYNC_COMPLETE once mode", () => {
    beforeEach(() => {
        sendMessage.mockReset()
        status.mockReset()
        success.mockReset()
        tryGitInit.mockReset()
        wasRecentlyDisconnected.mockReset()
        didShowDisconnect.mockReset()
        resetDisconnectState.mockReset()
        sendMessage.mockResolvedValue(true)
        wasRecentlyDisconnected.mockReturnValue(false)
        didShowDisconnect.mockReturnValue(false)
    })

    it("shuts down after the initial sync when once mode is enabled", async () => {
        const shutdown = vi.fn().mockResolvedValue(undefined)

        await executeEffect(
            {
                type: "SYNC_COMPLETE",
                totalCount: 2,
                updatedCount: 1,
                unchangedCount: 1,
            },
            {
                config: createConfig({ once: true }),
                kernel: new SyncKernel(),
                shutdown,
                syncState: {
                    internalPhase: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(sendMessage).toHaveBeenCalledWith(mockSocket, { type: "sync-phase", phase: "ready" })
        expect(status).toHaveBeenCalledWith("Sync complete, exiting...")
        expect(shutdown).toHaveBeenCalledTimes(1)
    })

    it("keeps watching when once mode is disabled", async () => {
        const shutdown = vi.fn().mockResolvedValue(undefined)

        await executeEffect(
            {
                type: "SYNC_COMPLETE",
                totalCount: 2,
                updatedCount: 1,
                unchangedCount: 1,
            },
            {
                config: createConfig({ once: false }),
                kernel: new SyncKernel(),
                shutdown,
                syncState: {
                    internalPhase: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(status).toHaveBeenCalledWith("Watching for changes...")
        expect(shutdown).not.toHaveBeenCalled()
    })
})
