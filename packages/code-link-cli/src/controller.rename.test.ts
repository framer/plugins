import fs from "fs/promises"
import os from "os"
import path from "path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { WebSocket } from "ws"
import { executeEffect } from "./controller.ts"
import type { Config } from "./types.ts"
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
        const pendingRenames = new Map<string, { oldFileName: string; content: string }>()

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
                pendingRenames,
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
        expect(pendingRenames.get("New.tsx")).toEqual({
            oldFileName: "Old.tsx",
            content: "export const New = () => null",
        })
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
        const pendingRenames = new Map<string, { oldFileName: string; content: string }>([
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
                pendingRenames,
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
        expect(pendingRenames.has("New.tsx")).toBe(false)

        await fs.rm(tmpDir, { recursive: true, force: true })
    })
})
