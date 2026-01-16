import fs from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WatcherEvent } from "../types.js"
import { initWatcher, type Watcher } from "./watcher.js"

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

describe("initWatcher", () => {
    afterEach(() => {
        createdWatchers.length = 0
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

        const addEvent = events.find(e => e.kind === "add")
        expect(addEvent).toBeDefined()
        expect(addEvent?.relativePath).toBe("bad_name_.tsx")
        expect(addEvent?.content).toContain("export const X")

        const renamedPath = path.join(tmpDir, "bad_name_.tsx")
        await expect(fs.readFile(renamedPath, "utf-8")).resolves.toContain("export const X")

        await watcher.close()
        await fs.rm(tmpDir, { recursive: true, force: true })
    })
})
