import type { PromptSession } from "@code-link/shared"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"
import type { WebSocket } from "ws"
import { type ApplyCtx, applyEffectResult, type DescribeCtx, describeEffect } from "./controller.ts"
import { SyncRuntime } from "./runtime.ts"
import type { SyncState } from "./sync-events.ts"
import type { Config } from "./types.ts"

function config(overrides: Partial<Config> = {}): Config {
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

function socket({ open = true }: { open?: boolean } = {}) {
    const sent: unknown[] = []
    return {
        sent,
        ws: {
            readyState: open ? 1 : 3,
            send(payload: string, cb?: (err?: Error | null) => void) {
                sent.push(JSON.parse(payload) as unknown)
                cb?.(null)
            },
        } as WebSocket,
    }
}

function applyCtx(runtime: SyncRuntime, ws: WebSocket | null): ApplyCtx {
    const syncState: SyncState =
        ws === null ? { internalPhase: "disconnected", socket: null } : { internalPhase: "watching", socket: ws }
    return {
        config: config(),
        runtime,
        syncState,
        shutdown: async () => {},
    }
}

describe("applyEffectResult transaction boundaries", () => {
    it("does not record a local send when the socket send fails", async () => {
        const runtime = new SyncRuntime()
        const closed = socket({ open: false })

        await applyEffectResult(
            {
                sends: [
                    {
                        message: { type: "file-change", fileName: "A.tsx", content: "x" },
                        onSent: [{ op: "recordLocalSend", path: "A.tsx", content: "x" }],
                    },
                ],
            },
            applyCtx(runtime, closed.ws)
        )

        expect(runtime.shouldSkipInboundEcho("A.tsx", "x")).toBe(false)
    })

    it("does not register a pending rename when the rename send fails", async () => {
        const runtime = new SyncRuntime()
        const closed = socket({ open: false })

        await applyEffectResult(
            {
                sends: [
                    {
                        message: {
                            type: "file-rename",
                            oldFileName: "Old.tsx",
                            newFileName: "New.tsx",
                            content: "x",
                        },
                        onSent: [
                            {
                                op: "registerPendingRename",
                                oldPath: "Old.tsx",
                                newPath: "New.tsx",
                                content: "x",
                            },
                        ],
                    },
                ],
            },
            applyCtx(runtime, closed.ws)
        )

        expect(runtime.getPendingRename("New.tsx")).toBeUndefined()
    })

    it("rolls back write echo and skips metadata when a remote disk write fails", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-write-fail-"))
        try {
            const filesDir = path.join(tmpDir, "files")
            await fs.mkdir(filesDir, { recursive: true })
            await fs.writeFile(path.join(filesDir, "Blocked.tsx"), "not a directory", "utf-8")

            const runtime = new SyncRuntime()
            runtime.configureWorkspace(tmpDir, false)

            await applyEffectResult(
                {
                    writes: {
                        files: [{ name: "Blocked.tsx/Nested.tsx", content: "x", modifiedAt: 1 }],
                    },
                },
                applyCtx(runtime, null)
            )

            expect(runtime.metadata.get("Blocked.tsx/Nested.tsx")).toBeUndefined()
            expect(runtime.shouldSkipInboundEcho("Blocked.tsx/Nested.tsx", "x")).toBe(false)
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    })

    it("rolls back delete tombstones and keeps metadata when a local delete fails", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-delete-fail-"))
        try {
            const filesDir = path.join(tmpDir, "files")
            await fs.mkdir(path.join(filesDir, "Folder.tsx"), { recursive: true })

            const runtime = new SyncRuntime()
            runtime.configureWorkspace(tmpDir, false)
            runtime.recordSyncedContent("Folder.tsx", "x", 1)

            await applyEffectResult({ deletes: ["Folder.tsx"] }, applyCtx(runtime, null))

            expect(runtime.metadata.get("Folder.tsx")).toBeDefined()
            expect(runtime.shouldSkipDeleteEcho("Folder.tsx")).toBe(false)
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    })

    it("starts delete prompts without awaiting a user decision", async () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()
        const open = socket()

        await applyEffectResult(
            { prompt: { kind: "deleteConfirmation", fileNames: ["A.tsx"], requireConfirmation: true } },
            applyCtx(runtime, open.ws)
        )

        expect(open.sent).toEqual([
            expect.objectContaining({
                type: "file-delete",
                fileNames: ["A.tsx"],
                requireConfirmation: true,
                session: expect.objectContaining({ connectionId: 1 }),
            }),
        ])
    })

    it("auto-delete sends exactly one remote delete and records only after send success", async () => {
        const runtime = new SyncRuntime()
        runtime.recordSyncedContent("A.tsx", "old", 1)
        const open = socket()
        const ctx: DescribeCtx = {
            config: config({ dangerouslyAutoDelete: true }),
            runtime,
            syncState: { internalPhase: "watching", socket: open.ws },
        }

        const result = await describeEffect({ type: "LOCAL_INITIATED_FILE_DELETE", fileNames: ["A.tsx"] }, ctx)
        await applyEffectResult(result, applyCtx(runtime, open.ws))

        expect(open.sent).toEqual([{ type: "file-delete", fileNames: ["A.tsx"] }])
        expect(runtime.metadata.get("A.tsx")).toBeUndefined()
    })

    it("refreshes an active conflict prompt when local conflict content changes", async () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()
        const open = socket()
        const prompt = runtime.startOrUpdateConflictPrompt([
            { fileName: "A.tsx", localContent: "old", remoteContent: "remote" },
        ])
        if (!prompt) throw new Error("Expected conflict prompt")

        await applyEffectResult(
            {
                runtimeOps: [{ op: "updateActiveConflictLocal", path: "A.tsx", content: "new" }],
                refreshConflictPrompt: true,
            },
            applyCtx(runtime, open.ws)
        )

        expect(open.sent).toEqual([
            {
                type: "conflicts-detected",
                session: prompt.session,
                conflicts: [{ fileName: "A.tsx", localContent: "new", remoteContent: "remote" }],
            },
        ])
    })

    it("clears an active conflict prompt and records metadata when the final conflict converges", async () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()
        const open = socket()
        const prompt = runtime.startOrUpdateConflictPrompt([
            { fileName: "A.tsx", localContent: "local", remoteContent: "remote" },
        ])
        if (!prompt) throw new Error("Expected conflict prompt")

        await applyEffectResult(
            {
                runtimeOps: [{ op: "updateActiveConflictRemote", path: "A.tsx", content: "local", modifiedAt: 123 }],
                refreshConflictPrompt: true,
                persistState: true,
            },
            applyCtx(runtime, open.ws)
        )

        expect(open.sent).toEqual([{ type: "conflicts-cleared", session: prompt.session }])
        expect(runtime.getActiveConflictPrompt()).toBeNull()
        expect(runtime.metadata.get("A.tsx")?.lastRemoteTimestamp).toBe(123)
    })

    it("sends delete prompt path invalidations without clearing unrelated pending deletes", async () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()
        const open = socket()
        const prompt = runtime.startDeletePrompt(["A.tsx", "B.tsx"])
        if (!prompt) throw new Error("Expected delete prompt")

        await applyEffectResult(
            {
                runtimeOps: [{ op: "invalidateDeletePromptPath", path: "A.tsx" }],
                refreshDeletePrompt: true,
            },
            applyCtx(runtime, open.ws)
        )

        expect(open.sent).toEqual([{ type: "delete-prompt-cleared", session: prompt.session, fileNames: ["A.tsx"] }])
        expect(runtime.getDeletePromptFileNames(prompt.session, ["A.tsx", "B.tsx"])).toEqual(["B.tsx"])
    })
})

describe("prompt response describe boundaries", () => {
    it("turns stale delete responses into a log-only result", async () => {
        const runtime = new SyncRuntime()
        const stale: PromptSession = { connectionId: 99, promptId: "stale" }
        const ctx: DescribeCtx = {
            config: config(),
            runtime,
            syncState: { internalPhase: "watching", socket: socket().ws },
        }

        const result = await describeEffect(
            { type: "RESOLVE_DELETE_PROMPT", session: stale, confirmedFileNames: ["A.tsx"], cancelledFiles: [] },
            ctx
        )

        expect(result).toEqual({
            logs: [{ level: "warn", message: "Ignoring stale delete prompt response (session or paths mismatch)" }],
        })
    })

    it("ignores delete prompt responses for paths that were invalidated", async () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()
        const prompt = runtime.startDeletePrompt(["A.tsx", "B.tsx"])
        if (!prompt) throw new Error("Expected prompt")
        runtime.invalidateDeletePromptPath("A.tsx")
        const ctx: DescribeCtx = {
            config: config(),
            runtime,
            syncState: { internalPhase: "watching", socket: socket().ws },
        }

        const result = await describeEffect(
            {
                type: "RESOLVE_DELETE_PROMPT",
                session: prompt.session,
                confirmedFileNames: ["A.tsx"],
                cancelledFiles: [],
            },
            ctx
        )

        expect(result).toEqual({
            logs: [{ level: "warn", message: "Ignoring stale delete prompt response (session or paths mismatch)" }],
        })
    })
})
