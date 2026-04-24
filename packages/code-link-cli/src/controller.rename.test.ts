/**
 * Rename + metadata bookkeeping specs.
 *
 * Style: value-equality on the `EffectResult` returned by `describeEffect`.
 * No `vi.mock`, no `vi.fn`, no `vi.spyOn` — these tests inspect the pure
 * description of what the controller wants to do. Actual mutation is exercised
 * by the integration test.
 */

import fs from "fs/promises"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"
import type { WebSocket } from "ws"
import { describeEffect, describeSendLocalChange, type DescribeCtx } from "./controller.ts"
import { SyncRuntime } from "./runtime.ts"
import type { Config } from "./types.ts"

const mockSocket = {} as WebSocket

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

function watchingCtx(runtime: SyncRuntime, config: Config = baseConfig()): DescribeCtx {
    if (config.projectDir && !runtime.workspace.projectDir) {
        runtime.configureWorkspace(config.projectDir, config.projectDirCreated ?? false)
    }
    return {
        config,
        runtime,
        syncState: { internalPhase: "watching", socket: mockSocket },
    }
}

describe("SEND_FILE_RENAME — describe", () => {
    it("returns echo-cleanup runtimeOps when the rename is an echoed write+delete", async () => {
        const runtime = new SyncRuntime()
        const content = "export const New = () => null"
        runtime.armContentEcho("New.tsx", content)
        runtime.armDeleteTombstone("Old.tsx")

        const result = await describeEffect(
            { type: "SEND_FILE_RENAME", oldFileName: "Old.tsx", newFileName: "New.tsx", content },
            watchingCtx(runtime)
        )

        expect(result).toEqual({
            logs: [{ level: "debug", message: "Skipping echoed rename Old.tsx -> New.tsx" }],
            runtimeOps: [
                { op: "clearContentEcho", path: "New.tsx" },
                { op: "clearDeleteTombstone", path: "Old.tsx" },
            ],
        })
    })

    it("describes a file-rename send + registerPendingRename runtimeOp for a fresh rename", async () => {
        const runtime = new SyncRuntime()
        const content = "export const New = () => null"

        const result = await describeEffect(
            { type: "SEND_FILE_RENAME", oldFileName: "Old.tsx", newFileName: "New.tsx", content },
            watchingCtx(runtime)
        )

        expect(result).toEqual({
            sends: [
                {
                    message: { type: "file-rename", oldFileName: "Old.tsx", newFileName: "New.tsx", content },
                    onSent: [
                        {
                            op: "registerPendingRename",
                            oldPath: "Old.tsx",
                            newPath: "New.tsx",
                            content,
                        },
                    ],
                },
            ],
        })
    })

    it("normalizes an extensionless rename target in both the send and the runtimeOp", async () => {
        const runtime = new SyncRuntime()
        const content = "export const New = () => null"

        const result = await describeEffect(
            { type: "SEND_FILE_RENAME", oldFileName: "Old.tsx", newFileName: "New", content },
            watchingCtx(runtime)
        )

        expect(result).toEqual({
            sends: [
                {
                    message: { type: "file-rename", oldFileName: "Old.tsx", newFileName: "New.tsx", content },
                    onSent: [
                        {
                            op: "registerPendingRename",
                            oldPath: "Old.tsx",
                            newPath: "New.tsx",
                            content,
                        },
                    ],
                },
            ],
        })
    })

    it("warns when there is no active socket instead of emitting a send", async () => {
        const runtime = new SyncRuntime()
        const ctx: DescribeCtx = {
            config: baseConfig(),
            runtime,
            syncState: { internalPhase: "disconnected", socket: null },
        }

        const result = await describeEffect(
            {
                type: "SEND_FILE_RENAME",
                oldFileName: "Old.tsx",
                newFileName: "New.tsx",
                content: "x",
            },
            ctx
        )

        expect(result).toEqual({
            logs: [
                {
                    level: "warn",
                    message: "No socket available to send rename Old.tsx -> New.tsx",
                },
            ],
        })
    })
})

describe("UPDATE_FILE_METADATA — describe", () => {
    it("describes rename cleanup ops when a pending rename is settled with current disk content", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })
        const content = "export const New = () => null"
        await fs.writeFile(path.join(filesDir, "New.tsx"), content, "utf-8")

        try {
            const runtime = new SyncRuntime()
            runtime.registerPendingRename("New.tsx", { oldFileName: "Old.tsx", content })

            const result = await describeEffect(
                { type: "UPDATE_FILE_METADATA", fileName: "New.tsx", remoteModifiedAt: 1234 },
                watchingCtx(runtime, baseConfig({ projectDir: tmpDir, filesDir }))
            )

            expect(result).toEqual({
                runtimeOps: [
                    { op: "recordRemoteApplied", path: "New.tsx", content, modifiedAt: 1234 },
                    { op: "recordDelete", path: "Old.tsx" },
                    { op: "recordLocalSend", path: "New.tsx", content },
                    { op: "completePendingRename", newPath: "New.tsx" },
                ],
            })
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    })

    it("uses current disk content for recordRemoteApplied when a newer local change has landed", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-late-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })
        await fs.writeFile(path.join(filesDir, "New.tsx"), "export const New = 2", "utf-8")

        try {
            const runtime = new SyncRuntime()
            runtime.registerPendingRename("New.tsx", {
                oldFileName: "Old.tsx",
                content: "export const New = 1",
            })

            const result = await describeEffect(
                { type: "UPDATE_FILE_METADATA", fileName: "New.tsx", remoteModifiedAt: 1234 },
                watchingCtx(runtime, baseConfig({ projectDir: tmpDir, filesDir }))
            )

            expect(result.runtimeOps).toContainEqual({
                op: "recordRemoteApplied",
                path: "New.tsx",
                content: "export const New = 2",
                modifiedAt: 1234,
            })
            expect(result.runtimeOps).toContainEqual({
                op: "recordLocalSend",
                path: "New.tsx",
                content: "export const New = 2",
            })
            expect(result.runtimeOps).toContainEqual({ op: "completePendingRename", newPath: "New.tsx" })
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    })

    it("falls back to the pending rename content when the file is gone from disk", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-missing-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })

        try {
            const runtime = new SyncRuntime()
            const pending = "export const New = () => null"
            runtime.registerPendingRename("New.tsx", { oldFileName: "Old.tsx", content: pending })

            const result = await describeEffect(
                { type: "UPDATE_FILE_METADATA", fileName: "New.tsx", remoteModifiedAt: 5678 },
                watchingCtx(runtime, baseConfig({ projectDir: tmpDir, filesDir }))
            )

            expect(result).toEqual({
                runtimeOps: [
                    { op: "recordRemoteApplied", path: "New.tsx", content: pending, modifiedAt: 5678 },
                    { op: "recordDelete", path: "Old.tsx" },
                    { op: "completePendingRename", newPath: "New.tsx" },
                ],
            })
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    })
})

describe("describeSendLocalChange", () => {
    it("describes a push with recordLocalSend runtimeOp and file-change send", () => {
        const runtime = new SyncRuntime()

        const result = describeSendLocalChange({ fileName: "A.tsx", content: "x" }, runtime)

        expect(result).toEqual({
            logs: [{ level: "debug", message: "Local change detected: A.tsx" }],
            sends: [
                {
                    message: { type: "file-change", fileName: "A.tsx", content: "x" },
                    onSent: [{ op: "recordLocalSend", path: "A.tsx", content: "x" }],
                    fileUp: "A.tsx",
                    installerProcess: { fileName: "A.tsx", content: "x" },
                },
            ],
        })
    })

    it("skips the push when the content matches the last synced hash", () => {
        const runtime = new SyncRuntime()
        runtime.metadata.recordRemoteWrite("A.tsx", "x", 100)

        const result = describeSendLocalChange({ fileName: "A.tsx", content: "x" }, runtime)

        expect(result).toEqual({
            logs: [
                {
                    level: "debug",
                    message: "Skipping local change for A.tsx: matches last synced content",
                },
            ],
        })
    })

    it("returns an empty result when the change is an inbound echo", () => {
        const runtime = new SyncRuntime()
        runtime.armContentEcho("A.tsx", "x")

        const result = describeSendLocalChange({ fileName: "A.tsx", content: "x" }, runtime)

        expect(result).toEqual({})
    })
})
