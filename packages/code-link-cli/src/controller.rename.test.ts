import fs from "fs/promises"
import os from "os"
import path from "path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { WebSocket } from "ws"
import { executeEffect } from "./controller.ts"
import type { Config } from "./types.ts"
import { createHashTracker } from "./utils/hash-tracker.ts"
import { hashFileContent } from "./utils/state-persistence.ts"

const { sendMessage } = vi.hoisted(() => ({
    sendMessage: vi.fn(),
}))

vi.mock("./helpers/connection.ts", () => ({
    initConnection: vi.fn(),
    sendMessage,
}))

const mockSocket = {} as WebSocket

describe("rename confirmation bookkeeping", () => {
    beforeEach(() => {
        sendMessage.mockReset()
    })

    it("skips echoed remote renames when write and delete collapse into one watcher rename", async () => {
        const content = "export const New = () => null"
        const hashTracker = createHashTracker()
        hashTracker.remember("New.tsx", content)
        hashTracker.markDelete("Old.tsx")

        const pendingRenameConfirmations = new Map<string, { oldFileName: string; content: string }>()

        await executeEffect(
            {
                type: "SEND_FILE_RENAME",
                oldFileName: "Old.tsx",
                newFileName: "New.tsx",
                content,
            },
            {
                config: {
                    port: 0,
                    projectHash: "project",
                    projectDir: null,
                    filesDir: null,
                    dangerouslyAutoDelete: false,
                    allowUnsupportedNpm: false,
                } satisfies Config,
                hashTracker,
                installer: null,
                fileMetadataCache: {
                    recordDelete: vi.fn(),
                } as never,
                pendingRenameConfirmations,
                userActions: {} as never,
                syncState: {
                    mode: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(sendMessage).not.toHaveBeenCalled()
        expect(hashTracker.shouldSkipDelete("Old.tsx")).toBe(false)
        expect(hashTracker.shouldSkip("New.tsx", content)).toBe(false)
        expect(pendingRenameConfirmations.size).toBe(0)
    })

    it("waits for file-synced before deleting old tracking", async () => {
        sendMessage.mockResolvedValue(true)

        const hashTracker = {
            remember: vi.fn(),
            shouldSkip: vi.fn(),
            forget: vi.fn(),
            clear: vi.fn(),
            markDelete: vi.fn(),
            shouldSkipDelete: vi.fn(),
            clearDelete: vi.fn(),
        }
        const fileMetadataCache = {
            recordDelete: vi.fn(),
        }
        const pendingRenameConfirmations = new Map<string, { oldFileName: string; content: string }>()

        await executeEffect(
            {
                type: "SEND_FILE_RENAME",
                oldFileName: "Old.tsx",
                newFileName: "New.tsx",
                content: "export const New = () => null",
            },
            {
                config: {
                    port: 0,
                    projectHash: "project",
                    projectDir: null,
                    filesDir: null,
                    dangerouslyAutoDelete: false,
                    allowUnsupportedNpm: false,
                } satisfies Config,
                hashTracker: hashTracker as never,
                installer: null,
                fileMetadataCache: fileMetadataCache as never,
                pendingRenameConfirmations,
                userActions: {} as never,
                syncState: {
                    mode: "watching",
                    socket: {} as never,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(sendMessage).toHaveBeenCalledWith(
            expect.anything(),
            {
                type: "file-rename",
                oldFileName: "Old.tsx",
                newFileName: "New.tsx",
                content: "export const New = () => null",
            }
        )
        expect(hashTracker.forget).not.toHaveBeenCalled()
        expect(hashTracker.remember).not.toHaveBeenCalled()
        expect(fileMetadataCache.recordDelete).not.toHaveBeenCalled()
        expect(pendingRenameConfirmations.get("New.tsx")).toEqual({
            oldFileName: "Old.tsx",
            content: "export const New = () => null",
        })
    })

    it("normalizes extensionless rename targets for later confirmation lookup", async () => {
        sendMessage.mockResolvedValue(true)

        const hashTracker = {
            remember: vi.fn(),
            shouldSkip: vi.fn(),
            forget: vi.fn(),
            clear: vi.fn(),
            markDelete: vi.fn(),
            shouldSkipDelete: vi.fn(),
            clearDelete: vi.fn(),
        }
        const pendingRenameConfirmations = new Map<string, { oldFileName: string; content: string }>()

        await executeEffect(
            {
                type: "SEND_FILE_RENAME",
                oldFileName: "Old.tsx",
                newFileName: "New",
                content: "export const New = () => null",
            },
            {
                config: {
                    port: 0,
                    projectHash: "project",
                    projectDir: null,
                    filesDir: null,
                    dangerouslyAutoDelete: false,
                    allowUnsupportedNpm: false,
                } satisfies Config,
                hashTracker: hashTracker as never,
                installer: null,
                fileMetadataCache: {
                    recordDelete: vi.fn(),
                } as never,
                pendingRenameConfirmations,
                userActions: {} as never,
                syncState: {
                    mode: "watching",
                    socket: {} as never,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(sendMessage).toHaveBeenCalledWith(
            expect.anything(),
            {
                type: "file-rename",
                oldFileName: "Old.tsx",
                newFileName: "New.tsx",
                content: "export const New = () => null",
            }
        )
        expect(pendingRenameConfirmations.get("New.tsx")).toEqual({
            oldFileName: "Old.tsx",
            content: "export const New = () => null",
        })
        expect(pendingRenameConfirmations.has("New")).toBe(false)
    })

    it("applies old-file cleanup after file-synced arrives", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })
        await fs.writeFile(path.join(filesDir, "New.tsx"), "export const New = () => null", "utf-8")

        const hashTracker = {
            remember: vi.fn(),
            shouldSkip: vi.fn(),
            forget: vi.fn(),
            clear: vi.fn(),
            markDelete: vi.fn(),
            shouldSkipDelete: vi.fn(),
            clearDelete: vi.fn(),
        }
        const fileMetadataCache = {
            recordSyncedSnapshot: vi.fn(),
            recordDelete: vi.fn(),
        }
        const pendingRenameConfirmations = new Map<string, { oldFileName: string; content: string }>([
            ["New.tsx", { oldFileName: "Old.tsx", content: "export const New = () => null" }],
        ])

        await executeEffect(
            {
                type: "UPDATE_FILE_METADATA",
                fileName: "New.tsx",
                remoteModifiedAt: 1234,
            },
            {
                config: {
                    port: 0,
                    projectHash: "project",
                    projectDir: tmpDir,
                    filesDir,
                    dangerouslyAutoDelete: false,
                    allowUnsupportedNpm: false,
                } satisfies Config,
                hashTracker: hashTracker as never,
                installer: null,
                fileMetadataCache: fileMetadataCache as never,
                pendingRenameConfirmations,
                userActions: {} as never,
                syncState: {
                    mode: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(fileMetadataCache.recordSyncedSnapshot).toHaveBeenCalledWith(
            "New.tsx",
            hashFileContent("export const New = () => null"),
            1234
        )
        expect(hashTracker.forget).toHaveBeenCalledWith("Old.tsx")
        expect(fileMetadataCache.recordDelete).toHaveBeenCalledWith("Old.tsx")
        expect(hashTracker.remember).toHaveBeenCalledWith("New.tsx", "export const New = () => null")
        expect(pendingRenameConfirmations.has("New.tsx")).toBe(false)

        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("applies old-file cleanup when file-synced uses a normalized rename target", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-normalized-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })

        const hashTracker = {
            remember: vi.fn(),
            shouldSkip: vi.fn(),
            forget: vi.fn(),
            clear: vi.fn(),
            markDelete: vi.fn(),
            shouldSkipDelete: vi.fn(),
            clearDelete: vi.fn(),
        }
        const fileMetadataCache = {
            recordSyncedSnapshot: vi.fn(),
            recordDelete: vi.fn(),
        }
        const pendingRenameConfirmations = new Map<string, { oldFileName: string; content: string }>()

        sendMessage.mockResolvedValue(true)

        await executeEffect(
            {
                type: "SEND_FILE_RENAME",
                oldFileName: "Old.tsx",
                newFileName: "New",
                content: "export const New = () => null",
            },
            {
                config: {
                    port: 0,
                    projectHash: "project",
                    projectDir: tmpDir,
                    filesDir,
                    dangerouslyAutoDelete: false,
                    allowUnsupportedNpm: false,
                } satisfies Config,
                hashTracker: hashTracker as never,
                installer: null,
                fileMetadataCache: fileMetadataCache as never,
                pendingRenameConfirmations,
                userActions: {} as never,
                syncState: {
                    mode: "watching",
                    socket: {} as never,
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
                config: {
                    port: 0,
                    projectHash: "project",
                    projectDir: tmpDir,
                    filesDir,
                    dangerouslyAutoDelete: false,
                    allowUnsupportedNpm: false,
                } satisfies Config,
                hashTracker: hashTracker as never,
                installer: null,
                fileMetadataCache: fileMetadataCache as never,
                pendingRenameConfirmations,
                userActions: {} as never,
                syncState: {
                    mode: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(fileMetadataCache.recordSyncedSnapshot).toHaveBeenCalledWith(
            "New.tsx",
            hashFileContent("export const New = () => null"),
            1234
        )
        expect(hashTracker.forget).toHaveBeenCalledWith("Old.tsx")
        expect(fileMetadataCache.recordDelete).toHaveBeenCalledWith("Old.tsx")
        expect(hashTracker.remember).not.toHaveBeenCalled()
        expect(pendingRenameConfirmations.has("New.tsx")).toBe(false)

        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("uses current file content when cleanup runs after a newer local change", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-rename-late-"))
        const filesDir = path.join(tmpDir, "files")
        await fs.mkdir(filesDir, { recursive: true })
        await fs.writeFile(path.join(filesDir, "New.tsx"), "export const New = 2", "utf-8")

        const hashTracker = {
            remember: vi.fn(),
            shouldSkip: vi.fn(),
            forget: vi.fn(),
            clear: vi.fn(),
            markDelete: vi.fn(),
            shouldSkipDelete: vi.fn(),
            clearDelete: vi.fn(),
        }
        const fileMetadataCache = {
            recordSyncedSnapshot: vi.fn(),
            recordDelete: vi.fn(),
        }
        const pendingRenameConfirmations = new Map<string, { oldFileName: string; content: string }>([
            ["New.tsx", { oldFileName: "Old.tsx", content: "export const New = 1" }],
        ])

        await executeEffect(
            {
                type: "UPDATE_FILE_METADATA",
                fileName: "New.tsx",
                remoteModifiedAt: 1234,
            },
            {
                config: {
                    port: 0,
                    projectHash: "project",
                    projectDir: tmpDir,
                    filesDir,
                    dangerouslyAutoDelete: false,
                    allowUnsupportedNpm: false,
                } satisfies Config,
                hashTracker: hashTracker as never,
                installer: null,
                fileMetadataCache: fileMetadataCache as never,
                pendingRenameConfirmations,
                userActions: {} as never,
                syncState: {
                    mode: "watching",
                    socket: mockSocket,
                    pendingRemoteChanges: [],
                },
            }
        )

        expect(fileMetadataCache.recordSyncedSnapshot).toHaveBeenCalledWith("New.tsx", hashFileContent("export const New = 2"), 1234)
        expect(hashTracker.forget).toHaveBeenCalledWith("Old.tsx")
        expect(fileMetadataCache.recordDelete).toHaveBeenCalledWith("Old.tsx")
        expect(hashTracker.remember).toHaveBeenCalledWith("New.tsx", "export const New = 2")
        expect(pendingRenameConfirmations.has("New.tsx")).toBe(false)

        await fs.rm(tmpDir, { recursive: true, force: true })
    })

})
