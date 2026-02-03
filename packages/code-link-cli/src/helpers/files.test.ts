import fs from "fs/promises"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"
import type { Conflict } from "../types.ts"
import { hashFileContent } from "../utils/state-persistence.ts"
import { autoResolveConflicts, DEFAULT_REMOTE_DRIFT_MS, detectConflicts } from "./files.ts"

function makeConflict(overrides: Partial<Conflict> = {}): Conflict {
    return {
        fileName: overrides.fileName ?? "Test.tsx",
        localContent: "localContent" in overrides ? overrides.localContent : "local",
        remoteContent: "remoteContent" in overrides ? overrides.remoteContent : "remote",
        localModifiedAt: overrides.localModifiedAt ?? Date.now(),
        remoteModifiedAt: overrides.remoteModifiedAt ?? Date.now(),
        lastSyncedAt: "lastSyncedAt" in overrides ? overrides.lastSyncedAt : Date.now(),
        localClean: overrides.localClean,
    }
}

// Auto-Resolve Conflicts Tests
describe("autoResolveConflicts", () => {
    it("classifies conflicts as local when remote unchanged and local changed", () => {
        const conflict = makeConflict({
            lastSyncedAt: 5_000,
            localClean: false,
        })

        const result = autoResolveConflicts([conflict], [{ fileName: conflict.fileName, latestRemoteVersionMs: 5_000 }])

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
        const syncTime = 5_000
        const conflict = makeConflict({
            lastSyncedAt: syncTime,
            localClean: false,
        })

        // Remote changed well after sync (beyond drift threshold)
        const remoteTime = syncTime + DEFAULT_REMOTE_DRIFT_MS + 1000
        const result = autoResolveConflicts(
            [conflict],
            [{ fileName: conflict.fileName, latestRemoteVersionMs: remoteTime }]
        )

        expect(result.remainingConflicts).toHaveLength(1)
        expect(result.autoResolvedLocal).toHaveLength(0)
        expect(result.autoResolvedRemote).toHaveLength(0)
    })

    it("auto-resolves to remote when local is clean, even without version data", () => {
        const conflict = makeConflict({
            lastSyncedAt: 5_000,
            localClean: true,
        })

        const result = autoResolveConflicts([conflict], [])

        // Local is clean (unchanged), so safe to take remote without needing version data
        expect(result.autoResolvedRemote).toHaveLength(1)
        expect(result.remainingConflicts).toHaveLength(0)
    })

    it("keeps conflicts when version data is missing and local was modified", () => {
        const conflict = makeConflict({
            lastSyncedAt: 5_000,
            localClean: false, // Local was modified
        })

        const result = autoResolveConflicts([conflict], [])

        // Can't determine if remote also changed, so keep as conflict
        expect(result.remainingConflicts).toHaveLength(1)
        expect(result.autoResolvedLocal).toHaveLength(0)
    })

    it("auto-resolves remote deletion when local is clean", () => {
        const conflict = makeConflict({
            remoteContent: null, // Deleted in Framer
            localClean: true,
        })

        const result = autoResolveConflicts([conflict], [])

        // Remote deletion with clean local -> auto-resolve to remote (delete locally)
        expect(result.autoResolvedRemote).toHaveLength(1)
        expect(result.remainingConflicts).toHaveLength(0)
    })

    it("keeps conflict when remote deleted but local modified", () => {
        const conflict = makeConflict({
            remoteContent: null, // Deleted in Framer
            localClean: false, // But local was modified
        })

        const result = autoResolveConflicts([conflict], [])

        // User must decide: keep local changes or accept deletion
        expect(result.remainingConflicts).toHaveLength(1)
        expect(result.autoResolvedRemote).toHaveLength(0)
    })

    it("keeps conflict when localClean is undefined (no persisted state)", () => {
        const conflict = makeConflict({
            lastSyncedAt: undefined,
            localClean: undefined, // No persisted state to compare against
        })

        const result = autoResolveConflicts(
            [conflict],
            [{ fileName: conflict.fileName, latestRemoteVersionMs: 10_000 }]
        )

        // Can't determine if local changed, so keep as conflict
        expect(result.remainingConflicts).toHaveLength(1)
    })

    it("auto-resolves local deletion when remote unchanged", () => {
        const syncTime = 5_000
        const conflict = makeConflict({
            localContent: null, // Deleted locally
            lastSyncedAt: syncTime,
            localClean: undefined, // N/A for deletions
        })

        // Remote version is same as last sync (within drift tolerance)
        const result = autoResolveConflicts(
            [conflict],
            [{ fileName: conflict.fileName, latestRemoteVersionMs: syncTime }]
        )

        // Remote unchanged since sync, local deleted -> keep deletion (resolve to local)
        expect(result.autoResolvedLocal).toHaveLength(1)
        expect(result.remainingConflicts).toHaveLength(0)
    })

    it("keeps conflict when local deleted but remote changed", () => {
        const syncTime = 5_000
        const conflict = makeConflict({
            localContent: null, // Deleted locally
            lastSyncedAt: syncTime,
            localClean: undefined,
        })

        // Remote was modified well after last sync (beyond drift threshold)
        const remoteTime = syncTime + DEFAULT_REMOTE_DRIFT_MS + 1000
        const result = autoResolveConflicts(
            [conflict],
            [{ fileName: conflict.fileName, latestRemoteVersionMs: remoteTime }]
        )

        // Both sides changed: local deleted, remote modified -> conflict
        expect(result.remainingConflicts).toHaveLength(1)
    })
})

// Detect Conflicts Tests
describe("detectConflicts", () => {
    it("marks conflicts as localClean when local matches persisted state", async () => {
        const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cl-test-"))
        try {
            const filesDir = path.join(tmpRoot, "files")
            await fs.mkdir(filesDir, { recursive: true })

            const localContent = "local content"
            await fs.writeFile(path.join(filesDir, "Test.tsx"), localContent, "utf-8")

            // Keys are normalized to lowercase for case-insensitive lookup
            const persistedState = new Map([
                ["test.tsx", { contentHash: hashFileContent(localContent), timestamp: 1_000 }],
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

    it("detects remote-only files as safe writes (new files to download)", async () => {
        const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cl-test-"))
        try {
            const filesDir = path.join(tmpRoot, "files")
            await fs.mkdir(filesDir, { recursive: true })

            // No local files, one remote file
            const result = await detectConflicts(
                [
                    {
                        name: "NewFromFramer.tsx",
                        content: "export const New = () => <div>New</div>",
                        modifiedAt: Date.now(),
                    },
                ],
                filesDir,
                { persistedState: new Map() }
            )

            // Remote-only file should be a safe write
            expect(result.writes).toHaveLength(1)
            expect(result.writes[0]?.name).toBe("NewFromFramer.tsx")
            expect(result.conflicts).toHaveLength(0)
            expect(result.localOnly).toHaveLength(0)
        } finally {
            await fs.rm(tmpRoot, { recursive: true, force: true })
        }
    })

    it("detects local-only files (new files to upload)", async () => {
        const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cl-test-"))
        try {
            const filesDir = path.join(tmpRoot, "files")
            await fs.mkdir(filesDir, { recursive: true })

            // Create a local file that doesn't exist in remote
            await fs.writeFile(
                path.join(filesDir, "LocalOnly.tsx"),
                "export const Local = () => <div>Local</div>",
                "utf-8"
            )

            const result = await detectConflicts(
                [], // No remote files
                filesDir,
                { persistedState: new Map() }
            )

            // Local-only file should be detected
            expect(result.localOnly).toHaveLength(1)
            expect(result.localOnly[0]?.name).toBe("LocalOnly.tsx")
            expect(result.writes).toHaveLength(0)
            expect(result.conflicts).toHaveLength(0)
        } finally {
            await fs.rm(tmpRoot, { recursive: true, force: true })
        }
    })

    it("handles case-insensitive file matching (macOS/Windows compat)", async () => {
        const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cl-test-"))
        try {
            const filesDir = path.join(tmpRoot, "files")
            await fs.mkdir(filesDir, { recursive: true })

            // Local file with different casing than remote
            await fs.writeFile(path.join(filesDir, "mycomponent.tsx"), "local content", "utf-8")

            const result = await detectConflicts(
                [
                    {
                        name: "MyComponent.tsx", // Different casing
                        content: "remote content",
                        modifiedAt: Date.now(),
                    },
                ],
                filesDir,
                { persistedState: new Map() }
            )

            // Should detect as conflict, not as two separate files
            expect(result.conflicts).toHaveLength(1)
            expect(result.localOnly).toHaveLength(0)
            expect(result.writes).toHaveLength(0)
        } finally {
            await fs.rm(tmpRoot, { recursive: true, force: true })
        }
    })

    it("detects local deletion while offline as conflict", async () => {
        const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cl-test-"))
        try {
            const filesDir = path.join(tmpRoot, "files")
            await fs.mkdir(filesDir, { recursive: true })

            // File was previously synced but now missing locally
            // Keys are normalized to lowercase for case-insensitive lookup
            const persistedState = new Map([
                ["deletedlocally.tsx", { contentHash: hashFileContent("old content"), timestamp: 1_000 }],
            ])

            const result = await detectConflicts(
                [
                    {
                        name: "DeletedLocally.tsx",
                        content: "remote content still exists",
                        modifiedAt: 2_000,
                    },
                ],
                filesDir,
                { persistedState }
            )

            // Should be a conflict: local=null (deleted), remote=content
            expect(result.conflicts).toHaveLength(1)
            expect(result.conflicts[0]?.localContent).toBe(null)
            expect(result.conflicts[0]?.remoteContent).toBe("remote content still exists")
        } finally {
            await fs.rm(tmpRoot, { recursive: true, force: true })
        }
    })

    it("detects remote deletion while offline as conflict", async () => {
        const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cl-test-"))
        try {
            const filesDir = path.join(tmpRoot, "files")
            await fs.mkdir(filesDir, { recursive: true })

            // Local file still exists
            await fs.writeFile(path.join(filesDir, "DeletedRemotely.tsx"), "local content still exists", "utf-8")

            // File was previously synced
            // Keys are normalized to lowercase for case-insensitive lookup
            const persistedState = new Map([
                [
                    "deletedremotely.tsx",
                    {
                        contentHash: hashFileContent("local content still exists"),
                        timestamp: 1_000,
                    },
                ],
            ])

            const result = await detectConflicts(
                [], // File no longer in remote
                filesDir,
                { persistedState }
            )

            // Should be a conflict: local=content, remote=null (deleted)
            expect(result.conflicts).toHaveLength(1)
            expect(result.conflicts[0]?.localContent).toBe("local content still exists")
            expect(result.conflicts[0]?.remoteContent).toBe(null)
        } finally {
            await fs.rm(tmpRoot, { recursive: true, force: true })
        }
    })

    it("treats identical content as unchanged (no write needed)", async () => {
        const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cl-test-"))
        try {
            const filesDir = path.join(tmpRoot, "files")
            await fs.mkdir(filesDir, { recursive: true })

            const content = "export const Same = () => <div>Same</div>"
            await fs.writeFile(path.join(filesDir, "Same.tsx"), content, "utf-8")

            const result = await detectConflicts(
                [
                    {
                        name: "Same.tsx",
                        content, // Same content
                        modifiedAt: Date.now(),
                    },
                ],
                filesDir,
                { persistedState: new Map() }
            )

            // No write needed, no conflict
            expect(result.writes).toHaveLength(0)
            expect(result.conflicts).toHaveLength(0)
            expect(result.unchanged).toHaveLength(1)
        } finally {
            await fs.rm(tmpRoot, { recursive: true, force: true })
        }
    })
})
