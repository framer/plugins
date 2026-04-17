import fs from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WebSocket } from "ws"
import { describeSendLocalChange, executeEffect } from "./controller.ts"
import { SyncKernel } from "./kernel.ts"
import type { Config } from "./types.ts"
import { hashFileContent } from "./utils/state-persistence.ts"
import * as connection from "./helpers/connection.ts"

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

describe("rename confirmation bookkeeping", () => {
    let sendSpy: ReturnType<typeof vi.spyOn>

    afterEach(() => {
        sendSpy?.mockRestore()
    })

    it("skips echoed remote renames when write and delete collapse into one watcher rename", async () => {
        const kernel = new SyncKernel()
        const content = "export const New = () => null"
        kernel.rememberLocalSend("New.tsx", content)
        kernel.markDeleteBeforeUnlink("Old.tsx")

        sendSpy = vi.spyOn(connection, "sendMessage").mockResolvedValue(true)

        await executeEffect(
            {
                type: "SEND_FILE_RENAME",
                oldFileName: "Old.tsx",
                newFileName: "New.tsx",
                content,
            },
            {
                config: baseConfig(),
                kernel,
                shutdown: async () => {},
                syncState: {
                    internalPhase: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(sendSpy).not.toHaveBeenCalled()
        expect(kernel.shouldSkipDeleteEcho("Old.tsx")).toBe(false)
        expect(kernel.shouldSkipInboundEcho("New.tsx", content)).toBe(false)
        expect(kernel.getPendingRename("New.tsx")).toBeUndefined()
    })

    it("waits for file-synced before deleting old tracking", async () => {
        const kernel = new SyncKernel()
        sendSpy = vi.spyOn(connection, "sendMessage").mockResolvedValue(true)

        await executeEffect(
            {
                type: "SEND_FILE_RENAME",
                oldFileName: "Old.tsx",
                newFileName: "New.tsx",
                content: "export const New = () => null",
            },
            {
                config: baseConfig(),
                kernel,
                shutdown: async () => {},
                syncState: {
                    internalPhase: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(sendSpy).toHaveBeenCalledWith(expect.anything(), {
            type: "file-rename",
            oldFileName: "Old.tsx",
            newFileName: "New.tsx",
            content: "export const New = () => null",
        })
        expect(kernel.getPendingRename("New.tsx")).toEqual({
            oldFileName: "Old.tsx",
            content: "export const New = () => null",
        })
    })

    it("normalizes extensionless rename targets for later confirmation lookup", async () => {
        const kernel = new SyncKernel()
        sendSpy = vi.spyOn(connection, "sendMessage").mockResolvedValue(true)

        await executeEffect(
            {
                type: "SEND_FILE_RENAME",
                oldFileName: "Old.tsx",
                newFileName: "New",
                content: "export const New = () => null",
            },
            {
                config: baseConfig(),
                kernel,
                shutdown: async () => {},
                syncState: {
                    internalPhase: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(sendSpy).toHaveBeenCalledWith(expect.anything(), {
            type: "file-rename",
            oldFileName: "Old.tsx",
            newFileName: "New.tsx",
            content: "export const New = () => null",
        })
        expect(kernel.getPendingRename("New.tsx")).toEqual({
            oldFileName: "Old.tsx",
            content: "export const New = () => null",
        })
        // Extensionless input normalizes to the same key as "New.tsx"
        expect(kernel.getPendingRename("New")).toEqual(kernel.getPendingRename("New.tsx"))
    })

    it("applies old-file cleanup after file-synced arrives", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })
        await fs.writeFile(path.join(filesDir, "New.tsx"), "export const New = () => null", "utf-8")

        const kernel = new SyncKernel()
        kernel.setPendingRename("New.tsx", { oldFileName: "Old.tsx", content: "export const New = () => null" })

        await executeEffect(
            {
                type: "UPDATE_FILE_METADATA",
                fileName: "New.tsx",
                remoteModifiedAt: 1234,
            },
            {
                config: baseConfig({ projectDir: tmpDir, filesDir }),
                kernel,
                shutdown: async () => {},
                syncState: {
                    internalPhase: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        const meta = kernel.metadata.get("New.tsx")
        expect(meta?.lastSyncedHash).toBe(hashFileContent("export const New = () => null"))
        expect(kernel.metadata.get("Old.tsx")).toBeUndefined()
        expect(kernel.getPendingRename("New.tsx")).toBeUndefined()

        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("applies old-file cleanup when file-synced uses a normalized rename target", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-normalized-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })

        const kernel = new SyncKernel()
        sendSpy = vi.spyOn(connection, "sendMessage").mockResolvedValue(true)

        await executeEffect(
            {
                type: "SEND_FILE_RENAME",
                oldFileName: "Old.tsx",
                newFileName: "New",
                content: "export const New = () => null",
            },
            {
                config: baseConfig({ projectDir: tmpDir, filesDir }),
                kernel,
                shutdown: async () => {},
                syncState: {
                    internalPhase: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        await executeEffect(
            {
                type: "UPDATE_FILE_METADATA",
                fileName: "New.tsx",
                remoteModifiedAt: 1234,
            },
            {
                config: baseConfig({ projectDir: tmpDir, filesDir }),
                kernel,
                shutdown: async () => {},
                syncState: {
                    internalPhase: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        const meta = kernel.metadata.get("New.tsx")
        expect(meta?.lastSyncedHash).toBe(hashFileContent("export const New = () => null"))
        expect(kernel.getPendingRename("New.tsx")).toBeUndefined()

        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("uses current file content when cleanup runs after a newer local change", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-late-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })
        await fs.writeFile(path.join(filesDir, "New.tsx"), "export const New = 2", "utf-8")

        const kernel = new SyncKernel()
        kernel.setPendingRename("New.tsx", { oldFileName: "Old.tsx", content: "export const New = 1" })

        await executeEffect(
            {
                type: "UPDATE_FILE_METADATA",
                fileName: "New.tsx",
                remoteModifiedAt: 1234,
            },
            {
                config: baseConfig({ projectDir: tmpDir, filesDir }),
                kernel,
                shutdown: async () => {},
                syncState: {
                    internalPhase: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(kernel.metadata.get("New.tsx")?.lastSyncedHash).toBe(hashFileContent("export const New = 2"))
        expect(kernel.getPendingRename("New.tsx")).toBeUndefined()

        await fs.rm(tmpDir, { recursive: true, force: true })
    })
})

describe("describeSendLocalChange", () => {
    it("returns EffectResult with recordLocalSend when a push is needed", () => {
        const kernel = new SyncKernel()
        const r = describeSendLocalChange({ fileName: "A.tsx", content: "x" }, kernel)
        expect(r).toEqual({
            kernelOps: [{ op: "recordLocalSend", path: "A.tsx", content: "x" }],
            sends: [{ type: "file-change", fileName: "A.tsx", content: "x" }],
            fileUp: "A.tsx",
            installerProcess: { fileName: "A.tsx", content: "x" },
        })
    })
})
