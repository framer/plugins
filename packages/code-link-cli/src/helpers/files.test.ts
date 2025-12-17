import fs from "fs/promises"
import os from "os"
import path from "path"
import { describe, it, expect } from "vitest"
import { autoResolveConflicts, detectConflicts } from "./files.js"
import type { Conflict } from "../types.js"
import { hashFileContent } from "../utils/state-persistence.js"

function makeConflict(overrides: Partial<Conflict> = {}): Conflict {
  return {
    fileName: overrides.fileName ?? "Test.tsx",
    localContent: overrides.localContent ?? "local",
    remoteContent: overrides.remoteContent ?? "remote",
    localModifiedAt: overrides.localModifiedAt ?? Date.now(),
    remoteModifiedAt: overrides.remoteModifiedAt ?? Date.now(),
    lastSyncedAt: overrides.lastSyncedAt ?? Date.now(),
    localClean: overrides.localClean,
  }
}

describe("autoResolveConflicts", () => {
  it("classifies conflicts as local when remote unchanged and local changed", () => {
    const conflict = makeConflict({
      lastSyncedAt: 5_000,
      localClean: false,
    })

    const result = autoResolveConflicts(
      [conflict],
      [{ fileName: conflict.fileName, latestRemoteVersionMs: 5_000 }]
    )

    expect(result.autoResolvedLocal).toHaveLength(1)
    expect(result.autoResolvedRemote).toHaveLength(0)
    expect(result.remainingConflicts).toHaveLength(0)
  })

  it("classifies conflicts as remote when local is clean and remote changed", () => {
    const conflict = makeConflict({
      lastSyncedAt: 5_000,
      localClean: true,
    })

    const result = autoResolveConflicts(
      [conflict],
      [{ fileName: conflict.fileName, latestRemoteVersionMs: 10_000 }]
    )

    expect(result.autoResolvedRemote).toHaveLength(1)
    expect(result.autoResolvedLocal).toHaveLength(0)
  })

  it("keeps conflicts that have both sides changed", () => {
    const conflict = makeConflict({
      lastSyncedAt: 5_000,
      localClean: false,
    })

    const result = autoResolveConflicts(
      [conflict],
      [{ fileName: conflict.fileName, latestRemoteVersionMs: 7_500 }]
    )

    expect(result.remainingConflicts).toHaveLength(1)
    expect(result.autoResolvedLocal).toHaveLength(0)
    expect(result.autoResolvedRemote).toHaveLength(0)
  })

  it("keeps conflicts when version data is missing", () => {
    const conflict = makeConflict({
      lastSyncedAt: 5_000,
      localClean: true,
    })

    const result = autoResolveConflicts([conflict], [])

    expect(result.remainingConflicts).toHaveLength(1)
  })
})

describe("detectConflicts", () => {
  it("marks conflicts as localClean when local matches persisted state", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cl-test-"))
    try {
      const filesDir = path.join(tmpRoot, "files")
      await fs.mkdir(filesDir, { recursive: true })

      const localContent = "local content"
      await fs.writeFile(path.join(filesDir, "Test.tsx"), localContent, "utf-8")

      const persistedState = new Map([
        [
          "Test.tsx",
          { contentHash: hashFileContent(localContent), timestamp: 1_000 },
        ],
      ])

      const result = await detectConflicts(
        [
          {
            name: "Test.tsx",
            content: "remote content",
            modifiedAt: 2_000,
          },
        ],
        filesDir,
        { persistedState }
      )

      expect(result.writes).toHaveLength(0)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]?.localClean).toBe(true)
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true })
    }
  })
})
