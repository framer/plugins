import type { SyncTracker } from "@code-link/shared"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CodeFilesAPI } from "./api"

const { framerMock } = vi.hoisted(() => ({
    framerMock: {
        createCodeFile: vi.fn(),
        getCodeFiles: vi.fn(),
        showUI: vi.fn(),
    },
}))

vi.mock("framer-plugin", () => ({
    framer: framerMock,
}))

vi.mock("./utils/logger", () => ({
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
}))

type MockSocket = {
    send: ReturnType<typeof vi.fn>
}

function createSocket(): MockSocket {
    return {
        send: vi.fn(),
    }
}

function getSentMessages(socket: MockSocket) {
    return socket.send.mock.calls.map(([payload]) => JSON.parse(payload as string))
}

function createTracker(): SyncTracker {
    return {
        remember: vi.fn(),
        shouldSkip: vi.fn(),
        forget: vi.fn(),
        clear: vi.fn(),
    }
}

function createCodeFile({
    content,
    name,
    path,
}: {
    content: string
    name?: string
    path?: string
}) {
    return {
        content,
        getVersions: vi.fn(),
        name,
        path,
        remove: vi.fn(),
        rename: vi.fn(),
        setFileContent: vi.fn(),
    }
}

function setup() {
    return {
        api: new CodeFilesAPI(),
        socket: createSocket(),
        tracker: createTracker(),
    }
}

function mockCodeFiles(files: ReturnType<typeof createCodeFile>[]) {
    framerMock.getCodeFiles.mockResolvedValue(files)
}

async function publishSnapshotAndClear({
    api,
    socket,
    files,
}: {
    api: CodeFilesAPI
    socket: MockSocket
    files: ReturnType<typeof createCodeFile>[]
}) {
    mockCodeFiles(files)
    await api.publishSnapshot(socket as unknown as WebSocket)
    socket.send.mockClear()
}

describe("CodeFilesAPI", () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it("publishes a canonicalized snapshot and seeds later diffing", async () => {
        const { api, socket, tracker } = setup()

        const files = [
            createCodeFile({ path: "components/Foo.tsx", content: "export const Foo = 1" }),
            createCodeFile({ name: "Bar.ts", content: "export const Bar = 1" }),
        ]
        mockCodeFiles(files)

        await api.publishSnapshot(socket as unknown as WebSocket)

        expect(getSentMessages(socket)).toEqual([
            {
                type: "file-list",
                files: [
                    { name: "components/Foo.tsx", content: "export const Foo = 1" },
                    { name: "Bar.ts", content: "export const Bar = 1" },
                ],
            },
        ])

        socket.send.mockClear()
        mockCodeFiles(files)

        await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)

        expect(socket.send).not.toHaveBeenCalled()
        expect(tracker.remember).not.toHaveBeenCalled()
    })

    it("emits incremental file changes and deletes", async () => {
        const { api, socket, tracker } = setup()

        await publishSnapshotAndClear({
            api,
            socket,
            files: [
                createCodeFile({ name: "Changed.tsx", content: "export const Changed = 1" }),
                createCodeFile({ name: "Removed.tsx", content: "export const Removed = 1" }),
            ],
        })

        mockCodeFiles([
            createCodeFile({ name: "Changed.tsx", content: "export const Changed = 2" }),
            createCodeFile({ name: "Added.tsx", content: "export const Added = 1" }),
        ])

        await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)

        expect(getSentMessages(socket)).toHaveLength(3)
        expect(getSentMessages(socket)).toEqual(
            expect.arrayContaining([
                {
                    type: "file-change",
                    fileName: "Changed.tsx",
                    content: "export const Changed = 2",
                },
                {
                    type: "file-change",
                    fileName: "Added.tsx",
                    content: "export const Added = 1",
                },
                {
                    type: "file-delete",
                    fileNames: ["Removed.tsx"],
                    requireConfirmation: false,
                },
            ])
        )
        expect(tracker.remember).toHaveBeenCalledTimes(2)
        expect(tracker.remember).toHaveBeenNthCalledWith(1, "Changed.tsx", "export const Changed = 2")
        expect(tracker.remember).toHaveBeenNthCalledWith(2, "Added.tsx", "export const Added = 1")
    })

    it("normalizes extensionless remote changes and seeds snapshot state after a successful write", async () => {
        const { api, socket, tracker } = setup()
        const content = "export const New = 1"

        framerMock.getCodeFiles.mockResolvedValueOnce([])

        await api.applyRemoteChange("New", content, socket as unknown as WebSocket)

        expect(framerMock.createCodeFile).toHaveBeenCalledWith("New.tsx", content, {
            editViaPlugin: false,
        })
        expect(getSentMessages(socket)).toEqual([
            expect.objectContaining({
                type: "file-synced",
                fileName: "New.tsx",
                remoteModifiedAt: expect.any(Number),
            }),
        ])

        socket.send.mockClear()
        mockCodeFiles([
            createCodeFile({ name: "New.tsx", content }),
        ])

        await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)

        expect(socket.send).not.toHaveBeenCalled()
        expect(tracker.remember).not.toHaveBeenCalled()
    })

    it("does not update snapshot state when a remote write fails", async () => {
        const { api, socket, tracker } = setup()
        const oldContent = "export const Broken = 1"
        const newContent = "export const Broken = 2"
        const existing = createCodeFile({ name: "Broken.tsx", content: oldContent })

        existing.setFileContent.mockRejectedValueOnce(new Error("write failed"))

        await publishSnapshotAndClear({
            api,
            socket,
            files: [createCodeFile({ name: "Broken.tsx", content: oldContent })],
        })

        framerMock.getCodeFiles.mockResolvedValueOnce([existing])

        await expect(api.applyRemoteChange("Broken.tsx", newContent, socket as unknown as WebSocket)).rejects.toThrow(
            "write failed"
        )
        expect(socket.send).not.toHaveBeenCalled()

        mockCodeFiles([createCodeFile({ name: "Broken.tsx", content: newContent })])

        await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)

        expect(getSentMessages(socket)).toEqual([
            {
                type: "file-change",
                fileName: "Broken.tsx",
                content: newContent,
            },
        ])
        expect(tracker.remember).toHaveBeenCalledWith("Broken.tsx", newContent)
    })

    it("renames a file to a normalized target and updates snapshot state", async () => {
        const { api, socket, tracker } = setup()
        const content = "export const Old = 1"
        const existing = createCodeFile({ name: "Old.tsx", content })

        await publishSnapshotAndClear({
            api,
            socket,
            files: [createCodeFile({ name: "Old.tsx", content })],
        })

        framerMock.getCodeFiles.mockResolvedValueOnce([existing])

        await expect(api.applyRemoteRename("Old.tsx", "New", socket as unknown as WebSocket)).resolves.toBe(true)

        expect(existing.rename).toHaveBeenCalledWith("New.tsx")
        expect(getSentMessages(socket)).toEqual([
            expect.objectContaining({
                type: "file-synced",
                fileName: "New.tsx",
                remoteModifiedAt: expect.any(Number),
            }),
        ])

        socket.send.mockClear()
        mockCodeFiles([
            createCodeFile({ name: "New.tsx", content }),
        ])

        await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)

        expect(socket.send).not.toHaveBeenCalled()
        expect(tracker.remember).not.toHaveBeenCalled()
    })

    it("returns an error when rename cannot fetch code files", async () => {
        const { api, socket } = setup()

        framerMock.getCodeFiles.mockRejectedValueOnce(new Error("fetch failed"))

        await expect(api.applyRemoteRename("Old.tsx", "New", socket as unknown as WebSocket)).resolves.toBe(false)

        expect(getSentMessages(socket)).toEqual([
            {
                type: "error",
                fileName: "New.tsx",
                message: "Failed to fetch code files for rename Old.tsx -> New",
            },
        ])
    })

    it("returns an error for missing rename sources and clears stale snapshot state", async () => {
        const { api, socket, tracker } = setup()

        await publishSnapshotAndClear({
            api,
            socket,
            files: [createCodeFile({ name: "Old.tsx", content: "export const Old = 1" })],
        })

        framerMock.getCodeFiles.mockResolvedValueOnce([])

        await expect(api.applyRemoteRename("Old.tsx", "New", socket as unknown as WebSocket)).resolves.toBe(false)

        expect(getSentMessages(socket)).toEqual([
            {
                type: "error",
                fileName: "New.tsx",
                message: "Rename failed: Old.tsx not found in Framer",
            },
        ])

        socket.send.mockClear()
        mockCodeFiles([])

        await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)

        expect(socket.send).not.toHaveBeenCalled()
    })

    it("returns an error when rename throws and does not confirm sync", async () => {
        const { api, socket } = setup()
        const existing = createCodeFile({ name: "Old.tsx", content: "export const Old = 1" })

        existing.rename.mockRejectedValueOnce(new Error("rename failed"))
        framerMock.getCodeFiles.mockResolvedValueOnce([existing])

        await expect(api.applyRemoteRename("Old.tsx", "New", socket as unknown as WebSocket)).resolves.toBe(false)

        expect(getSentMessages(socket)).toEqual([
            {
                type: "error",
                fileName: "New.tsx",
                message: "Failed to rename Old.tsx -> New",
            },
        ])
    })
})
