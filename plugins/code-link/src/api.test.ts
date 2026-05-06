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
    | { type: "file-delete"; fileNames: string[] }
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
    const api = new CodeFilesAPI()
    return {
        api,
        socket: createSocket(),
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

describe("CodeFilesAPI snapshot echo state", () => {
    it("does not treat unseen empty files as echoes", () => {
        const state = new CodeFilesAPI()

        expect(state.shouldSkip("Empty.tsx", "")).toBe(false)

        state.remember("Empty.tsx", "")

        expect(state.shouldSkip("Empty.tsx", "")).toBe(true)
    })

    it("uses exact content for echo checks", () => {
        const state = new CodeFilesAPI()
        const head = "h".repeat(50)
        const tail = "t".repeat(50)

        state.remember("Collision.tsx", `${head}A${tail}`)

        expect(state.shouldSkip("Collision.tsx", `${head}B${tail}`)).toBe(false)
    })
})

describe("CodeFilesAPI", () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it("publishes a normalized snapshot with ensured extensions and seeds later diffing", async () => {
        const { api, socket } = setup()

        const files = [
            createCodeFile({ path: "components/Foo.tsx", content: "export const Foo = 1" }),
            createCodeFile({ name: "Bar.ts", content: "export const Bar = 1" }),
            createCodeFile({ name: "Baz", content: "export const Baz = 1" }),
        ]
        mockCodeFiles(files)

        await api.publishSnapshot(socket as unknown as WebSocket)

        expect(getSentMessages(socket)).toEqual([
            {
                type: "file-list",
                files: [
                    { name: "components/Foo.tsx", content: "export const Foo = 1" },
                    { name: "Bar.ts", content: "export const Bar = 1" },
                    { name: "Baz.tsx", content: "export const Baz = 1" },
                ],
            },
        ])

        socket.send.mockClear()
        mockCodeFiles(files)

        await api.handleFramerFilesChanged(socket as unknown as WebSocket)

        expect(socket.send).not.toHaveBeenCalled()
    })

    it("emits incremental file changes and deletes", async () => {
        const { api, socket } = setup()

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

        await api.handleFramerFilesChanged(socket as unknown as WebSocket)

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
                },
            ])
        )
        expect(api.getSnapshotContent("Changed.tsx")).toBe("export const Changed = 2")
        expect(api.getSnapshotContent("Added.tsx")).toBe("export const Added = 1")
        expect(api.getSnapshotContent("Removed.tsx")).toBeUndefined()
    })

    it("normalizes extensionless remote changes and seeds snapshot state after a successful write", async () => {
        const { api, socket } = setup()
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

        await api.handleFramerFilesChanged(socket as unknown as WebSocket)

        expect(socket.send).not.toHaveBeenCalled()
    })

    it("updates an existing extensionless Framer file instead of creating a duplicate", async () => {
        const { api, socket } = setup()
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

        await api.handleFramerFilesChanged(socket as unknown as WebSocket)

        expect(socket.send).not.toHaveBeenCalled()
    })

    it("seeds snapshot before a remote write finishes to avoid echoing subscription updates", async () => {
        const { api, socket } = setup()
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
            await api.handleFramerFilesChanged(socket as unknown as WebSocket)
        })

        await api.applyRemoteChange("Race.tsx", newContent, socket as unknown as WebSocket)

        const sentMessages = getSentMessages(socket)
        expect(sentMessages).toHaveLength(1)
        expectFileSyncedMessage(sentMessages[0], "Race.tsx")
    })

    it("does not update snapshot state when a remote write fails", async () => {
        const { api, socket } = setup()
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

        await api.handleFramerFilesChanged(socket as unknown as WebSocket)

        expect(getSentMessages(socket)).toEqual([
            {
                type: "file-change",
                fileName: "Broken.tsx",
                content: newContent,
            },
        ])
        expect(api.getSnapshotContent("Broken.tsx")).toBe(newContent)
    })

    it("renames a file to a normalized target and updates snapshot state", async () => {
        const { api, socket } = setup()
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

        await api.handleFramerFilesChanged(socket as unknown as WebSocket)

        expect(socket.send).not.toHaveBeenCalled()
    })

    it("seeds snapshot before a remote rename finishes to avoid echoing subscription updates", async () => {
        const { api, socket } = setup()
        const content = "export const Old = 1"
        const existing = createCodeFile({ name: "Old.tsx", content })

        await publishSnapshotAndClear({
            api,
            socket,
            files: [createCodeFile({ name: "Old.tsx", content })],
        })

        framerMock.getCodeFiles.mockResolvedValueOnce([existing])
        existing.rename.mockImplementation(async (targetName: string) => {
            existing.name = targetName
            framerMock.getCodeFiles.mockResolvedValue([existing])
            await api.handleFramerFilesChanged(socket as unknown as WebSocket)
        })

        await expect(api.applyRemoteRename("Old.tsx", "New", socket as unknown as WebSocket)).resolves.toBe(true)

        const sentMessages = getSentMessages(socket)
        expect(sentMessages).toHaveLength(1)
        expectFileSyncedMessage(sentMessages[0], "New.tsx")
    })

    it("finds an extensionless rename source using its normalized name", async () => {
        const { api, socket } = setup()
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

        await api.handleFramerFilesChanged(socket as unknown as WebSocket)

        expect(socket.send).not.toHaveBeenCalled()
    })

    it("deletes an extensionless Framer file using a normalized name", async () => {
        const { api, socket } = setup()
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
        await api.handleFramerFilesChanged(socket as unknown as WebSocket)
        expect(socket.send).not.toHaveBeenCalled()
    })

    it("seeds snapshot before a remote delete finishes to avoid echoing subscription updates", async () => {
        const { api, socket } = setup()
        const content = "export const DeleteMe = 1"
        const existing = createCodeFile({ name: "DeleteMe.tsx", content })

        await publishSnapshotAndClear({
            api,
            socket,
            files: [createCodeFile({ name: "DeleteMe.tsx", content })],
        })

        framerMock.getCodeFiles.mockResolvedValueOnce([existing])
        existing.remove.mockImplementation(async () => {
            framerMock.getCodeFiles.mockResolvedValue([])
            await api.handleFramerFilesChanged(socket as unknown as WebSocket)
        })

        await api.applyRemoteDelete("DeleteMe.tsx")

        expect(socket.send).not.toHaveBeenCalled()
    })

    it("restores snapshot state when a remote delete fails", async () => {
        const { api, socket } = setup()
        const content = "export const DeleteMe = 1"
        const existing = createCodeFile({ name: "DeleteMe.tsx", content })

        await publishSnapshotAndClear({
            api,
            socket,
            files: [createCodeFile({ name: "DeleteMe.tsx", content })],
        })

        existing.remove.mockRejectedValueOnce(new Error("delete failed"))
        framerMock.getCodeFiles.mockResolvedValueOnce([existing])

        await expect(api.applyRemoteDelete("DeleteMe.tsx")).rejects.toThrow("delete failed")

        mockCodeFiles([createCodeFile({ name: "DeleteMe.tsx", content })])
        await api.handleFramerFilesChanged(socket as unknown as WebSocket)

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
        const { api, socket } = setup()

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

        await api.handleFramerFilesChanged(socket as unknown as WebSocket)

        expect(socket.send).not.toHaveBeenCalled()
    })

    it("returns an error when rename throws and does not confirm sync", async () => {
        const { api, socket } = setup()
        const content = "export const Old = 1"
        const existing = createCodeFile({ name: "Old.tsx", content })

        await publishSnapshotAndClear({
            api,
            socket,
            files: [createCodeFile({ name: "Old.tsx", content })],
        })

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

        socket.send.mockClear()
        mockCodeFiles([createCodeFile({ name: "Old.tsx", content })])
        await api.handleFramerFilesChanged(socket as unknown as WebSocket)

        expect(socket.send).not.toHaveBeenCalled()
    })
})
