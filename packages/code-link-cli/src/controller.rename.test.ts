import fs from "fs/promises"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"
import type { WebSocket } from "ws"
import { type ApplyCtx, applyEffect } from "./controller.ts"
import { SyncRuntime } from "./runtime.ts"
import type { SyncState } from "./sync-events.ts"
import type { Config } from "./types.ts"

function baseConfig(overrides: Partial<Config> = {}): Config {
    return {
        port: 0,
        projectHash: "project",
        projectDir: null,
        filesDir: null,
        dangerouslyAutoDelete: false,
        allowUnsupportedNpm: false,
        ...overrides,
    }
}

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

function ctx(runtime: SyncRuntime, ws: WebSocket | null, config: Config = baseConfig()): ApplyCtx {
    const syncState: SyncState =
        ws === null ? { phase: "disconnected", socket: null } : { phase: "watching", socket: ws }
    if (config.projectDir && !runtime.workspace.projectDir) runtime.configureWorkspace(config.projectDir, false)
    return { config, runtime, syncState, shutdown: async () => {} }
}

describe("SEND_FILE_RENAME", () => {
    it("clears echo guards without sending when the rename is an echoed write+delete", async () => {
        const runtime = new SyncRuntime()
        const open = socket()
        const content = "export const New = () => null"
        runtime.memory.armContentEcho("New.tsx", content)
        runtime.memory.armExpectedDeleteEcho("Old.tsx")

        await applyEffect(
            { type: "SEND_FILE_RENAME", oldFileName: "Old.tsx", newFileName: "New.tsx", content },
            ctx(runtime, open.ws)
        )

        expect(open.sent).toEqual([])
        expect(runtime.memory.matchesContentEcho("New.tsx", content)).toBe(false)
        expect(runtime.memory.matchesExpectedDeleteEcho("Old.tsx")).toBe(false)
    })

    it("sends a file rename and registers the pending rename only after send success", async () => {
        const runtime = new SyncRuntime()
        const open = socket()
        const content = "export const New = () => null"

        await applyEffect(
            { type: "SEND_FILE_RENAME", oldFileName: "Old.tsx", newFileName: "New.tsx", content },
            ctx(runtime, open.ws)
        )

        expect(open.sent).toEqual([{ type: "file-rename", oldFileName: "Old.tsx", newFileName: "New.tsx", content }])
        expect(runtime.getPendingRename("New.tsx")).toEqual({ oldFileName: "Old.tsx", content })
    })

    it("normalizes an extensionless rename target", async () => {
        const runtime = new SyncRuntime()
        const open = socket()
        const content = "export const New = () => null"

        await applyEffect(
            { type: "SEND_FILE_RENAME", oldFileName: "Old.tsx", newFileName: "New", content },
            ctx(runtime, open.ws)
        )

        expect(open.sent).toEqual([{ type: "file-rename", oldFileName: "Old.tsx", newFileName: "New.tsx", content }])
        expect(runtime.getPendingRename("New.tsx")).toEqual({ oldFileName: "Old.tsx", content })
    })

    it("does not register a pending rename when no socket is active", async () => {
        const runtime = new SyncRuntime()

        await applyEffect(
            { type: "SEND_FILE_RENAME", oldFileName: "Old.tsx", newFileName: "New.tsx", content: "x" },
            ctx(runtime, null)
        )

        expect(runtime.getPendingRename("New.tsx")).toBeUndefined()
    })
})

describe("UPDATE_FILE_METADATA", () => {
    it("settles a pending rename using current disk content", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-"))
        try {
            const filesDir = path.join(tmpDir, "files")
            await fs.mkdir(filesDir, { recursive: true })
            const content = "export const New = () => null"
            await fs.writeFile(path.join(filesDir, "New.tsx"), content, "utf-8")
            const runtime = new SyncRuntime()
            runtime.registerPendingRename("New.tsx", { oldFileName: "Old.tsx", content })

            await applyEffect(
                { type: "UPDATE_FILE_METADATA", fileName: "New.tsx", remoteModifiedAt: 1234 },
                ctx(runtime, null, baseConfig({ projectDir: tmpDir, filesDir }))
            )

            expect(runtime.metadata.get("New.tsx")?.lastRemoteTimestamp).toBe(1234)
            expect(runtime.metadata.get("Old.tsx")).toBeUndefined()
            expect(runtime.memory.matchesContentEcho("New.tsx", content)).toBe(true)
            expect(runtime.getPendingRename("New.tsx")).toBeUndefined()
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    })

    it("uses newer disk content when a later local edit landed before the ack", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-late-"))
        try {
            const filesDir = path.join(tmpDir, "files")
            await fs.mkdir(filesDir, { recursive: true })
            await fs.writeFile(path.join(filesDir, "New.tsx"), "export const New = 2", "utf-8")
            const runtime = new SyncRuntime()
            runtime.registerPendingRename("New.tsx", {
                oldFileName: "Old.tsx",
                content: "export const New = 1",
            })

            await applyEffect(
                { type: "UPDATE_FILE_METADATA", fileName: "New.tsx", remoteModifiedAt: 1234 },
                ctx(runtime, null, baseConfig({ projectDir: tmpDir, filesDir }))
            )

            expect(runtime.metadata.get("New.tsx")?.lastSyncedHash).toBeDefined()
            expect(runtime.memory.matchesContentEcho("New.tsx", "export const New = 2")).toBe(true)
            expect(runtime.getPendingRename("New.tsx")).toBeUndefined()
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    })

    it("falls back to pending rename content when the file is gone from disk", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-missing-"))
        try {
            const filesDir = path.join(tmpDir, "files")
            await fs.mkdir(filesDir, { recursive: true })
            const runtime = new SyncRuntime()
            const pending = "export const New = () => null"
            runtime.registerPendingRename("New.tsx", { oldFileName: "Old.tsx", content: pending })

            await applyEffect(
                { type: "UPDATE_FILE_METADATA", fileName: "New.tsx", remoteModifiedAt: 5678 },
                ctx(runtime, null, baseConfig({ projectDir: tmpDir, filesDir }))
            )

            expect(runtime.metadata.get("New.tsx")?.lastRemoteTimestamp).toBe(5678)
            expect(runtime.memory.matchesContentEcho("New.tsx", pending)).toBe(false)
            expect(runtime.getPendingRename("New.tsx")).toBeUndefined()
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    })
})

describe("SEND_LOCAL_CHANGE", () => {
    it("pushes local content and arms the echo after send success", async () => {
        const runtime = new SyncRuntime()
        const open = socket()

        await applyEffect({ type: "SEND_LOCAL_CHANGE", fileName: "A.tsx", content: "x" }, ctx(runtime, open.ws))

        expect(open.sent).toEqual([{ type: "file-change", fileName: "A.tsx", content: "x" }])
        expect(runtime.memory.matchesContentEcho("A.tsx", "x")).toBe(true)
    })

    it("skips the push when content matches the last synced hash", async () => {
        const runtime = new SyncRuntime()
        runtime.metadata.recordRemoteWrite("A.tsx", "x", 100)
        const open = socket()

        await applyEffect({ type: "SEND_LOCAL_CHANGE", fileName: "A.tsx", content: "x" }, ctx(runtime, open.ws))

        expect(open.sent).toEqual([])
    })

    it("skips the push when the change is an inbound echo", async () => {
        const runtime = new SyncRuntime()
        runtime.memory.armContentEcho("A.tsx", "x")
        const open = socket()

        await applyEffect({ type: "SEND_LOCAL_CHANGE", fileName: "A.tsx", content: "x" }, ctx(runtime, open.ws))

        expect(open.sent).toEqual([])
    })
})
