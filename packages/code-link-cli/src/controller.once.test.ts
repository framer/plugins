import { describe, expect, it, vi } from "vitest"
import type { WebSocket } from "ws"
import { executeEffect } from "./controller.ts"
import { SyncKernel } from "./kernel.ts"
import type { Config } from "./types.ts"
import * as connection from "./helpers/connection.ts"

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
    it("shuts down after the initial sync when once mode is enabled", async () => {
        const sendSpy = vi.spyOn(connection, "sendMessage").mockResolvedValue(true)
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

        expect(sendSpy).toHaveBeenCalledWith(mockSocket, { type: "sync-phase", phase: "ready" })
        expect(shutdown).toHaveBeenCalledTimes(1)
        sendSpy.mockRestore()
    })

    it("keeps watching when once mode is disabled", async () => {
        const sendSpy = vi.spyOn(connection, "sendMessage").mockResolvedValue(true)
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

        expect(shutdown).not.toHaveBeenCalled()
        sendSpy.mockRestore()
    })
})
