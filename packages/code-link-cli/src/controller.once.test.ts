import { describe, expect, it } from "vitest"
import type { WebSocket } from "ws"
import { type ApplyCtx, applyEffect } from "./controller.ts"
import { SyncRuntime } from "./runtime.ts"
import type { SyncState } from "./sync-events.ts"
import type { Config } from "./types.ts"

function socket() {
    const sent: unknown[] = []
    return {
        sent,
        ws: {
            readyState: 1,
            send(payload: string, cb?: (err?: Error | null) => void) {
                sent.push(JSON.parse(payload) as unknown)
                cb?.(null)
            },
        } as WebSocket,
    }
}

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

function ctx(
    runtime: SyncRuntime,
    ws: WebSocket,
    config: Config,
    onShutdown?: () => void
): ApplyCtx & { didShutdown: () => boolean } {
    let didShutdown = false
    if (config.projectDir && !runtime.workspace.projectDir) {
        runtime.configureWorkspace(config.projectDir, config.projectDirCreated ?? false)
    }
    const syncState: SyncState = { internalPhase: "watching", socket: ws }
    return {
        config,
        runtime,
        syncState,
        shutdown: async () => {
            onShutdown?.()
            didShutdown = true
        },
        didShutdown: () => didShutdown,
    }
}

describe("SYNC_COMPLETE apply", () => {
    it("shuts down in once mode and records the ready phase", async () => {
        const runtime = new SyncRuntime()
        const open = socket()
        const applyCtx = ctx(runtime, open.ws, createConfig({ once: true }))

        await applyEffect({ type: "SYNC_COMPLETE", totalCount: 2, updatedCount: 1, unchangedCount: 1 }, applyCtx)

        expect(applyCtx.didShutdown()).toBe(true)
        expect(open.sent).toContainEqual({ type: "sync-phase", phase: "ready" })
        expect(runtime.lastEmittedSyncPhase).toBe("ready")
    })

    it("keeps watching when once is disabled", async () => {
        const runtime = new SyncRuntime()
        const open = socket()
        const applyCtx = ctx(runtime, open.ws, createConfig({ once: false }))

        await applyEffect({ type: "SYNC_COMPLETE", totalCount: 2, updatedCount: 1, unchangedCount: 1 }, applyCtx)

        expect(applyCtx.didShutdown()).toBe(false)
        expect(open.sent).toContainEqual({ type: "sync-phase", phase: "ready" })
        expect(runtime.lastEmittedSyncPhase).toBe("ready")
    })

    it("does not shut down on a reconnect where no notice was shown", async () => {
        const runtime = new SyncRuntime()
        runtime.disconnectUi.scheduleNotice(() => {})
        runtime.disconnectUi.cancelNotice()
        const open = socket()
        const applyCtx = ctx(runtime, open.ws, createConfig({ once: true }))

        await applyEffect({ type: "SYNC_COMPLETE", totalCount: 0, updatedCount: 0, unchangedCount: 0 }, applyCtx)

        expect(applyCtx.didShutdown()).toBe(false)
        expect(runtime.disconnectUi.wasRecentlyDisconnected()).toBe(false)
        expect(runtime.lastEmittedSyncPhase).toBe("ready")
    })

    it("clears resolved conflict prompts before once-mode shutdown", async () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()
        const open = socket()
        const prompt = runtime.startOrUpdateConflictPrompt([
            { fileName: "A.tsx", localContent: "local", remoteContent: "remote" },
        ])
        if (!prompt) throw new Error("Expected conflict prompt")

        let activePromptAtShutdown = true
        const applyCtx = ctx(runtime, open.ws, createConfig({ once: true }), () => {
            activePromptAtShutdown = runtime.getActiveConflictPrompt() !== null
        })

        await applyEffect(
            {
                type: "RESOLVE_CONFLICT_PROMPT",
                session: prompt.session,
                fileNames: ["A.tsx"],
                resolution: "local",
            },
            applyCtx
        )

        expect(applyCtx.didShutdown()).toBe(true)
        expect(activePromptAtShutdown).toBe(false)
        expect(runtime.getActiveConflictPrompt()).toBeNull()
    })
})
