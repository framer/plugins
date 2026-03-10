import type { SyncTracker } from "@code-link/shared"
import { afterEach, describe, expect, it, type Mock, vi } from "vitest"
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

type SentMessage =
    | { type: "file-list"; files: { name: string; content: string }[] }
    | { type: "file-change"; fileName: string; content: string }
    | { type: "file-delete"; fileNames: string[]; requireConfirmation: boolean }
    | { type: "file-synced"; fileName: string; remoteModifiedAt: number }
    | { type: "error"; fileName: string; message: string }

type FileSyncedMessage = Extract<SentMessage, { type: "file-synced" }>

interface MockSocket {
    send: Mock<(payload: string) => void>
}

function createSocket(): MockSocket {
    return {
        send: vi.fn(),
    }
}

function parseSentMessage(payload: string): SentMessage {
    return JSON.parse(payload) as SentMessage
}

function getSentMessages(socket: MockSocket): SentMessage[] {
    return socket.send.mock.calls.map(([payload]) => parseSentMessage(payload))
}

function expectFileSyncedMessage(
    message: SentMessage | undefined,
    fileName: string
): asserts message is FileSyncedMessage {
    expect(message).toMatchObject({
        type: "file-synced",
        fileName,
    })

    if (!message || message.type !== "file-synced") {
        throw new Error(`Expected file-synced message for ${fileName}`)
    }
}

function createTracker() {
    const remember = vi.fn()
    const shouldSkip = vi.fn()
    const forget = vi.fn()
    const clear = vi.fn()

    return {
        tracker: {
            remember,
            shouldSkip,
            forget,
            clear,
        } satisfies SyncTracker,
        remember,
    }
}

function createCodeFile({ content, name, path }: { content: string; name?: string; path?: string }) {
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
    const tracker = createTracker()
    return {
        api: new CodeFilesAPI(),
        socket: createSocket(),
        tracker: tracker.tracker,
        trackerRemember: tracker.remember,
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
        const { api, socket, tracker, trackerRemember } = setup()

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
        expect(trackerRemember).not.toHaveBeenCalled()
    })

    it("emits incremental file changes and deletes", async () => {
        const { api, socket, tracker, trackerRemember } = setup()

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
        expect(trackerRemember).toHaveBeenCalledTimes(2)
        expect(trackerRemember).toHaveBeenNthCalledWith(1, "Changed.tsx", "export const Changed = 2")
        expect(trackerRemember).toHaveBeenNthCalledWith(2, "Added.tsx", "export const Added = 1")
    })

    it("normalizes extensionless remote changes and seeds snapshot state after a successful write", async () => {
        const { api, socket, tracker, trackerRemember } = setup()
        const content = "export const New = 1"

        framerMock.getCodeFiles.mockResolvedValueOnce([])

        await api.applyRemoteChange("New", content, socket as unknown as WebSocket)

        expect(framerMock.createCodeFile).toHaveBeenCalledWith("New.tsx", content, {
            editViaPlugin: false,
        })
        const [syncMessage] = getSentMessages(socket)
        expectFileSyncedMessage(syncMessage, "New.tsx")
        expect(syncMessage.remoteModifiedAt).toEqual(expect.any(Number))

        socket.send.mockClear()
        mockCodeFiles([createCodeFile({ name: "New.tsx", content })])

        await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)

        expect(socket.send).not.toHaveBeenCalled()
        expect(trackerRemember).not.toHaveBeenCalled()
    })

    it("updates an existing extensionless Framer file instead of creating a duplicate", async () => {
        const { api, socket, tracker, trackerRemember } = setup()
        const oldContent = "export const New = 1"
        const newContent = "export const New = 2"
        const existing = createCodeFile({ name: "New", content: oldContent })

        framerMock.getCodeFiles.mockResolvedValueOnce([existing])

        await api.applyRemoteChange("New", newContent, socket as unknown as WebSocket)

        expect(existing.setFileContent).toHaveBeenCalledWith(newContent)
        expect(framerMock.createCodeFile).not.toHaveBeenCalled()
        const [syncMessage] = getSentMessages(socket)
        expectFileSyncedMessage(syncMessage, "New.tsx")

        socket.send.mockClear()
        mockCodeFiles([createCodeFile({ name: "New", content: newContent })])

        await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)

        expect(socket.send).not.toHaveBeenCalled()
        expect(trackerRemember).not.toHaveBeenCalled()
    })

    it("seeds snapshot before a remote write finishes to avoid echoing subscription updates", async () => {
        const { api, socket, tracker, trackerRemember } = setup()
        const oldContent = "export const Race = 1"
        const newContent = "export const Race = 2"
        const existing = createCodeFile({ name: "Race.tsx", content: oldContent })

        await publishSnapshotAndClear({
            api,
            socket,
            files: [createCodeFile({ name: "Race.tsx", content: oldContent })],
        })

        framerMock.getCodeFiles.mockResolvedValueOnce([existing])
        existing.setFileContent.mockImplementation(async (content: string) => {
            existing.content = content
            framerMock.getCodeFiles.mockResolvedValue([existing])
            await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)
        })

        await api.applyRemoteChange("Race.tsx", newContent, socket as unknown as WebSocket)

        const sentMessages = getSentMessages(socket)
        expect(sentMessages).toHaveLength(1)
        expectFileSyncedMessage(sentMessages[0], "Race.tsx")
        expect(trackerRemember).not.toHaveBeenCalled()
    })

    it("does not update snapshot state when a remote write fails", async () => {
        const { api, socket, tracker, trackerRemember } = setup()
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
        expect(trackerRemember).toHaveBeenCalledWith("Broken.tsx", newContent)
    })

    it("renames a file to a normalized target and updates snapshot state", async () => {
        const { api, socket, tracker, trackerRemember } = setup()
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
        const [syncMessage] = getSentMessages(socket)
        expectFileSyncedMessage(syncMessage, "New.tsx")
        expect(syncMessage.remoteModifiedAt).toEqual(expect.any(Number))

        socket.send.mockClear()
        mockCodeFiles([createCodeFile({ name: "New.tsx", content })])

        await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)

        expect(socket.send).not.toHaveBeenCalled()
        expect(trackerRemember).not.toHaveBeenCalled()
    })

    it("finds an extensionless rename source using its normalized name", async () => {
        const { api, socket, tracker, trackerRemember } = setup()
        const content = "export const Old = 1"
        const existing = createCodeFile({ name: "Old", content })

        await publishSnapshotAndClear({
            api,
            socket,
            files: [createCodeFile({ name: "Old", content })],
        })

        framerMock.getCodeFiles.mockResolvedValueOnce([existing])

        await expect(api.applyRemoteRename("Old.tsx", "New", socket as unknown as WebSocket)).resolves.toBe(true)

        expect(existing.rename).toHaveBeenCalledWith("New.tsx")

        socket.send.mockClear()
        mockCodeFiles([createCodeFile({ name: "New", content })])

        await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)

        expect(socket.send).not.toHaveBeenCalled()
        expect(trackerRemember).not.toHaveBeenCalled()
    })

    it("deletes an extensionless Framer file using a normalized name", async () => {
        const { api, socket, tracker } = setup()
        const existing = createCodeFile({ name: "DeleteMe", content: "export const DeleteMe = 1" })

        await publishSnapshotAndClear({
            api,
            socket,
            files: [createCodeFile({ name: "DeleteMe", content: "export const DeleteMe = 1" })],
        })

        framerMock.getCodeFiles.mockResolvedValueOnce([existing])

        await api.applyRemoteDelete("DeleteMe.tsx")

        expect(existing.remove).toHaveBeenCalled()

        mockCodeFiles([])
        await api.handleFramerFilesChanged(socket as unknown as WebSocket, tracker)
        expect(socket.send).not.toHaveBeenCalled()
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
