/**
 * SYNC_COMPLETE in `config.once` mode.
 *
 * Style: value-equality on the `EffectResult`. No `vi.fn`, no spies — we inspect
 * the pure shape of the shutdown decision. Whether apply actually calls
 * `ctx.shutdown()` is covered by the integration test; here we just check that
 * describe sets the `shutdown` flag.
 */

import { describe, expect, it } from "vitest"
import type { WebSocket } from "ws"
import { describeEffect, type DescribeCtx } from "./controller.ts"
import { SyncRuntime } from "./runtime.ts"
import type { Config } from "./types.ts"

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

function ctx(config: Config): DescribeCtx {
    const runtime = new SyncRuntime()
    if (config.projectDir) runtime.configureWorkspace(config.projectDir, config.projectDirCreated ?? false)
    return {
        config,
        runtime,
        syncState: { internalPhase: "watching", socket: mockSocket },
    }
}

describe("SYNC_COMPLETE describe", () => {
    it("sets shutdown:true and a 'Sync complete, exiting...' status log in once mode", async () => {
        const result = await describeEffect(
            { type: "SYNC_COMPLETE", totalCount: 2, updatedCount: 1, unchangedCount: 1 },
            ctx(createConfig({ once: true }))
        )

        expect(result.shutdown).toBe(true)
        expect(result.sends).toEqual([{ message: { type: "sync-phase", phase: "ready" } }])
        expect(result.runtimeOps).toEqual([{ op: "noteEmittedSyncPhase", phase: "ready" }])
        expect(result.logs).toContainEqual({ level: "status", message: "Sync complete, exiting..." })
    })

    it("sets shutdown:false and a 'Watching for changes...' status log when once is disabled", async () => {
        const result = await describeEffect(
            { type: "SYNC_COMPLETE", totalCount: 2, updatedCount: 1, unchangedCount: 1 },
            ctx(createConfig({ once: false }))
        )

        expect(result.shutdown).toBe(false)
        expect(result.logs).toContainEqual({ level: "status", message: "Watching for changes..." })
    })

    it("emits resetDisconnectState + silent shutdown:false on a reconnect where no notice was shown", async () => {
        const runtime = new SyncRuntime()
        // Simulate: was disconnected but the notice timer never fired → didShowNotice() === false.
        runtime.disconnectUi.scheduleNotice(() => {})
        runtime.disconnectUi.cancelNotice()
        // `wasRecentlyDisconnected` is still true (scheduleNotice set it); `didShowNotice` is false.

        const result = await describeEffect(
            { type: "SYNC_COMPLETE", totalCount: 0, updatedCount: 0, unchangedCount: 0 },
            {
                config: createConfig({ once: true }),
                runtime,
                syncState: {
                    internalPhase: "watching",
                    socket: mockSocket,
                },
            }
        )

        expect(result.shutdown).toBe(false)
        expect(result.logs).toEqual([])
        expect(result.runtimeOps).toEqual([
            { op: "noteEmittedSyncPhase", phase: "ready" },
            { op: "resetDisconnectState" },
        ])
    })
})
