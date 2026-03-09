import fs from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WatcherEvent } from "../types.ts"
import { initWatcher, type Watcher } from "./watcher.ts"

interface MockWatcher {
    on: (event: "add" | "change" | "unlink", handler: (file: string) => void) => MockWatcher
    __emit: (event: "add" | "change" | "unlink", filePath: string) => Promise<void>
    close: ReturnType<typeof vi.fn>
}

const createdWatchers: MockWatcher[] = []

vi.mock("chokidar", () => {
    const createMockWatcher = (): MockWatcher => {
        const handlers: Record<string, ((filePath: string) => void)[]> = {
            add: [],
            change: [],
            unlink: [],
        }

        return {
            on(event: "add" | "change" | "unlink", handler: (file: string) => void) {
                handlers[event].push(handler)
                return this
            },
            async __emit(event: "add" | "change" | "unlink", filePath: string) {
                for (const handler of handlers[event] ?? []) {
                    handler(filePath)
                }
                // Allow async handlers to complete
                await new Promise(resolve => setTimeout(resolve, 10))
            },
            close: vi.fn().mockResolvedValue(undefined),
        }
    }

    const watch = vi.fn(() => {
        const instance = createMockWatcher()
        createdWatchers.push(instance)
        return instance
    })

    return { default: { watch }, watch }
})

/** Wait for the rename buffer to expire */
const waitForBuffer = () => new Promise(resolve => setTimeout(resolve, 150))

describe("initWatcher", () => {
    afterEach(() => {
        createdWatchers.length = 0
        vi.useRealTimers()
    })

    it("ignores unsupported extensions and sanitizes added files", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))
        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        const unsupportedPath = path.join(tmpDir, "note.txt")
        await fs.writeFile(unsupportedPath, "hello", "utf-8")
        await rawWatcher.__emit("add", unsupportedPath)
        expect(events).toHaveLength(0)

        const rawPath = path.join(tmpDir, "bad name!.tsx")
        await fs.writeFile(rawPath, "export const X = 1;", "utf-8")
        await rawWatcher.__emit("add", rawPath)

        // Adds are buffered for rename detection, wait for buffer to expire
        await waitForBuffer()

        const addEvent = events.find(e => e.kind === "add")
        expect(addEvent).toBeDefined()
        expect(addEvent?.relativePath).toBe("bad_name_.tsx")
        expect(addEvent?.content).toContain("export const X")

        const renamedPath = path.join(tmpDir, "bad_name_.tsx")
        await expect(fs.readFile(renamedPath, "utf-8")).resolves.toContain("export const X")

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("falls back to the raw path when sanitization rename fails", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))
        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        const rawPath = path.join(tmpDir, "bad name!.tsx")
        await fs.writeFile(rawPath, "export const X = 1;", "utf-8")

        const renameSpy = vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("rename failed"))
        await rawWatcher.__emit("add", rawPath)

        await waitForBuffer()

        expect(events).toHaveLength(1)
        expect(events[0].kind).toBe("add")
        expect(events[0].relativePath).toBe("bad name!.tsx")
        await expect(fs.readFile(rawPath, "utf-8")).resolves.toContain("export const X")

        renameSpy.mockRestore()
        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })
})

describe("rename detection", () => {
    afterEach(() => {
        createdWatchers.length = 0
        vi.useRealTimers()
    })

    it("detects rename when unlink arrives before add", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))
        const content = "export const Component = () => null;"

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        // Write original file and emit add to populate hash cache
        const originalPath = path.join(tmpDir, "OldName.tsx")
        await fs.writeFile(originalPath, content, "utf-8")
        await rawWatcher.__emit("add", originalPath)
        await waitForBuffer()
        expect(events).toHaveLength(1)
        expect(events[0].kind).toBe("add")
        events.length = 0

        // Simulate rename: unlink old, then add new with same content
        await fs.unlink(originalPath)
        const newPath = path.join(tmpDir, "NewName.tsx")
        await fs.writeFile(newPath, content, "utf-8")
        await rawWatcher.__emit("unlink", originalPath)
        await rawWatcher.__emit("add", newPath)

        // Should get a single rename event (matched immediately, no buffer wait needed)
        expect(events).toHaveLength(1)
        expect(events[0].kind).toBe("rename")
        expect(events[0].relativePath).toBe("NewName.tsx")
        expect(events[0].oldRelativePath).toBe("OldName.tsx")
        expect(events[0].content).toBe(content)

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("detects rename when add arrives before unlink", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))
        const content = "export const Component = () => null;"

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        // Write original file and emit add to populate hash cache
        const originalPath = path.join(tmpDir, "OldName.tsx")
        await fs.writeFile(originalPath, content, "utf-8")
        await rawWatcher.__emit("add", originalPath)
        await waitForBuffer()
        expect(events).toHaveLength(1)
        expect(events[0].kind).toBe("add")
        events.length = 0

        // Simulate rename: add new first, then unlink old
        const newPath = path.join(tmpDir, "NewName.tsx")
        await fs.writeFile(newPath, content, "utf-8")
        await rawWatcher.__emit("add", newPath)
        await fs.unlink(originalPath)
        await rawWatcher.__emit("unlink", originalPath)

        // Should get a single rename event
        expect(events).toHaveLength(1)
        expect(events[0].kind).toBe("rename")
        expect(events[0].relativePath).toBe("NewName.tsx")
        expect(events[0].oldRelativePath).toBe("OldName.tsx")
        expect(events[0].content).toBe(content)

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("emits change when unlink and add target the same path with identical content", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))
        const content = "export const Component = () => null;"

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        const filePath = path.join(tmpDir, "Component.tsx")
        await fs.writeFile(filePath, content, "utf-8")
        await rawWatcher.__emit("add", filePath)
        await waitForBuffer()
        events.length = 0

        await fs.unlink(filePath)
        await rawWatcher.__emit("unlink", filePath)
        await fs.writeFile(filePath, content, "utf-8")
        await rawWatcher.__emit("add", filePath)

        expect(events).toHaveLength(1)
        expect(events[0]).toEqual({
            kind: "change",
            relativePath: "Component.tsx",
            content,
        })

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("emits change when unlink and add target the same path with different content", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        const filePath = path.join(tmpDir, "Component.tsx")
        await fs.writeFile(filePath, "export const Version = 1", "utf-8")
        await rawWatcher.__emit("add", filePath)
        await waitForBuffer()
        events.length = 0

        await fs.unlink(filePath)
        await rawWatcher.__emit("unlink", filePath)
        await fs.writeFile(filePath, "export const Version = 2", "utf-8")
        await rawWatcher.__emit("add", filePath)

        expect(events).toHaveLength(1)
        expect(events[0]).toEqual({
            kind: "change",
            relativePath: "Component.tsx",
            content: "export const Version = 2",
        })

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("emits change when add arrives before unlink for the same path and the file still exists", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        const filePath = path.join(tmpDir, "Component.tsx")
        await fs.writeFile(filePath, "export const Version = 1", "utf-8")
        await rawWatcher.__emit("add", filePath)
        await waitForBuffer()
        events.length = 0

        await fs.writeFile(filePath, "export const Version = 2", "utf-8")
        await rawWatcher.__emit("add", filePath)
        await rawWatcher.__emit("unlink", filePath)

        expect(events).toHaveLength(1)
        expect(events[0]).toEqual({
            kind: "change",
            relativePath: "Component.tsx",
            content: "export const Version = 2",
        })

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("suppresses transient add followed by unlink for a new file on the same path", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        const filePath = path.join(tmpDir, "Component.tsx")
        await fs.writeFile(filePath, "export const Temp = 1", "utf-8")
        await rawWatcher.__emit("add", filePath)
        await fs.unlink(filePath)
        await rawWatcher.__emit("unlink", filePath)

        expect(events).toHaveLength(0)

        await waitForBuffer()
        expect(events).toHaveLength(0)

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("falls back to add and delete when delete sees multiple matching adds", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))
        const content = "export const Component = () => null;"

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        const originalPath = path.join(tmpDir, "OldName.tsx")
        await fs.writeFile(originalPath, content, "utf-8")
        await rawWatcher.__emit("add", originalPath)
        await waitForBuffer()
        events.length = 0

        const newPathA = path.join(tmpDir, "NewNameA.tsx")
        const newPathB = path.join(tmpDir, "NewNameB.tsx")
        await fs.writeFile(newPathA, content, "utf-8")
        await fs.writeFile(newPathB, content, "utf-8")
        await rawWatcher.__emit("add", newPathA)
        await rawWatcher.__emit("add", newPathB)

        await fs.unlink(originalPath)
        await rawWatcher.__emit("unlink", originalPath)

        expect(events).toHaveLength(0)

        await waitForBuffer()

        expect(events).toHaveLength(3)
        expect(events.some(event => event.kind === "rename")).toBe(false)
        expect(events).toEqual(
            expect.arrayContaining([
                { kind: "add", relativePath: "NewNameA.tsx", content },
                { kind: "add", relativePath: "NewNameB.tsx", content },
                { kind: "delete", relativePath: "OldName.tsx" },
            ])
        )

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("falls back to add and delete when add sees multiple matching deletes", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))
        const content = "export const Component = () => null;"

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        const originalPathA = path.join(tmpDir, "OldNameA.tsx")
        const originalPathB = path.join(tmpDir, "OldNameB.tsx")
        await fs.writeFile(originalPathA, content, "utf-8")
        await fs.writeFile(originalPathB, content, "utf-8")
        await rawWatcher.__emit("add", originalPathA)
        await rawWatcher.__emit("add", originalPathB)
        await waitForBuffer()
        events.length = 0

        await fs.unlink(originalPathA)
        await fs.unlink(originalPathB)
        await rawWatcher.__emit("unlink", originalPathA)
        await rawWatcher.__emit("unlink", originalPathB)

        const newPath = path.join(tmpDir, "NewName.tsx")
        await fs.writeFile(newPath, content, "utf-8")
        await rawWatcher.__emit("add", newPath)

        expect(events).toHaveLength(0)

        await waitForBuffer()

        expect(events).toHaveLength(3)
        expect(events.some(event => event.kind === "rename")).toBe(false)
        expect(events).toEqual(
            expect.arrayContaining([
                { kind: "delete", relativePath: "OldNameA.tsx" },
                { kind: "delete", relativePath: "OldNameB.tsx" },
                { kind: "add", relativePath: "NewName.tsx", content },
            ])
        )

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("emits normal delete when no matching add arrives within buffer", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))
        const content = "export const X = 1;"

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        // Write and add to populate hash cache
        const filePath = path.join(tmpDir, "Component.tsx")
        await fs.writeFile(filePath, content, "utf-8")
        await rawWatcher.__emit("add", filePath)
        await waitForBuffer()
        events.length = 0

        // Unlink without a matching add
        await fs.unlink(filePath)
        await rawWatcher.__emit("unlink", filePath)

        // No event yet (buffered)
        expect(events).toHaveLength(0)

        // Wait for the buffer timeout to expire
        await waitForBuffer()
        expect(events).toHaveLength(1)
        expect(events[0].kind).toBe("delete")
        expect(events[0].relativePath).toBe("Component.tsx")

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("emits add and delete separately when content differs", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        // Write and add original file
        const originalPath = path.join(tmpDir, "Old.tsx")
        await fs.writeFile(originalPath, "original content", "utf-8")
        await rawWatcher.__emit("add", originalPath)
        await waitForBuffer()
        events.length = 0

        // Unlink old file
        await fs.unlink(originalPath)
        await rawWatcher.__emit("unlink", originalPath)

        // Add a different file with different content
        const newPath = path.join(tmpDir, "New.tsx")
        await fs.writeFile(newPath, "completely different content", "utf-8")
        await rawWatcher.__emit("add", newPath)

        // Both are buffered; no events yet
        expect(events).toHaveLength(0)

        // Wait for buffer timeout — both should fire as separate events
        await waitForBuffer()
        expect(events).toHaveLength(2)
        const kinds = events.map(e => e.kind).sort()
        expect(kinds).toEqual(["add", "delete"])

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("suppresses echo events from sanitization rename", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))
        const content = "export const X = 1;"

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        // Create a file with a name that needs sanitizing
        const rawPath = path.join(tmpDir, "bad name!.tsx")
        await fs.writeFile(rawPath, content, "utf-8")
        await rawWatcher.__emit("add", rawPath)

        // Simulate the echo events chokidar would fire after sanitization rename
        const sanitizedPath = path.join(tmpDir, "bad_name_.tsx")
        await rawWatcher.__emit("unlink", rawPath) // echo unlink for old path
        await rawWatcher.__emit("add", sanitizedPath) // echo add for new path

        await waitForBuffer()

        // Should only have the original add, no echoes
        expect(events).toHaveLength(1)
        expect(events[0].kind).toBe("add")
        expect(events[0].relativePath).toBe("bad_name_.tsx")

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("suppresses echo events from folder sanitization", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))
        const content = "export const Y = 2;"

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        // Create a file in a folder with spaces (needs sanitizing)
        const badFolderPath = path.join(tmpDir, "My Folder", "Component.tsx")
        await fs.mkdir(path.join(tmpDir, "My Folder"), { recursive: true })
        await fs.writeFile(badFolderPath, content, "utf-8")
        await rawWatcher.__emit("add", badFolderPath)

        // Simulate echo events from folder sanitization rename
        const sanitizedFolderPath = path.join(tmpDir, "My_Folder", "Component.tsx")
        await rawWatcher.__emit("unlink", badFolderPath) // echo unlink for old folder path
        await rawWatcher.__emit("add", sanitizedFolderPath) // echo add for sanitized folder path

        await waitForBuffer()

        // Should only have the original add
        expect(events).toHaveLength(1)
        expect(events[0].kind).toBe("add")
        expect(events[0].relativePath).toBe("My_Folder/Component.tsx")

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("emits delete immediately when file has no cached hash", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framer-watcher-"))

        const events: WatcherEvent[] = []
        const watcher: Watcher = initWatcher(tmpDir)
        watcher.on("change", event => events.push(event))
        const rawWatcher = createdWatchers.at(-1)
        if (!rawWatcher) throw new Error("No watcher created")

        // Emit unlink for a file that was never added (no hash cached)
        const unknownPath = path.join(tmpDir, "Unknown.tsx")
        await rawWatcher.__emit("unlink", unknownPath)

        // Delete should fire immediately (no buffering)
        expect(events).toHaveLength(1)
        expect(events[0].kind).toBe("delete")
        expect(events[0].relativePath).toBe("Unknown.tsx")

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })
})
