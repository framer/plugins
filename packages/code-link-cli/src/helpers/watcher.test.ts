import { describe, expect, it, vi, afterEach } from "vitest"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { initWatcher } from "./watcher.js"

const createdWatchers: any[] = []

vi.mock("chokidar", () => {
  const createMockWatcher = () => {
    const handlers: Record<string, Array<(filePath: string) => any>> = {
      add: [],
      change: [],
      unlink: [],
    }

    return {
      on(event: "add" | "change" | "unlink", handler: (file: string) => any) {
        handlers[event]?.push(handler)
        return this
      },
      async __emit(event: "add" | "change" | "unlink", filePath: string) {
        for (const handler of handlers[event] ?? []) {
          await handler(filePath)
        }
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
    const events: any[] = []
    const watcher = initWatcher(tmpDir)
    watcher.on("change", (event) => events.push(event))
    const rawWatcher = createdWatchers.at(-1)!

    const unsupportedPath = path.join(tmpDir, "note.txt")
    await fs.writeFile(unsupportedPath, "hello", "utf-8")
    await rawWatcher.__emit("add", unsupportedPath)
    expect(events).toHaveLength(0)

    const rawPath = path.join(tmpDir, "bad name!.tsx")
    await fs.writeFile(rawPath, "export const X = 1;", "utf-8")
    await rawWatcher.__emit("add", rawPath)

    const addEvent = events.find((e) => e.kind === "add")
    expect(addEvent).toBeDefined()
    expect(addEvent?.relativePath).toBe("bad_name_.tsx")
    expect(addEvent?.content).toContain("export const X")

    const renamedPath = path.join(tmpDir, "bad_name_.tsx")
    await expect(fs.readFile(renamedPath, "utf-8")).resolves.toContain(
      "export const X"
    )

    await watcher.close()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })
})
