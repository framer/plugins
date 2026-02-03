import { describe, expect, it } from "vitest"
import type { WebSocket } from "ws"
import { transition } from "./controller.ts"
import { DEFAULT_REMOTE_DRIFT_MS, filterEchoedFiles } from "./helpers/files.ts"
import { createHashTracker } from "./utils/hash-tracker.ts"

// Readable coverage of core controller functionality

const mockSocket = {} as WebSocket

function disconnectedState() {
    return {
        mode: "disconnected" as const,
        socket: null,
        pendingRemoteChanges: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
    }
}

function watchingState() {
    return {
        mode: "watching" as const,
        socket: mockSocket,
        pendingRemoteChanges: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
    }
}

function handshakingState() {
    return {
        mode: "handshaking" as const,
        socket: mockSocket,
        pendingRemoteChanges: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
    }
}

function snapshotProcessingState() {
    return {
        mode: "snapshot_processing" as const,
        socket: mockSocket,
        pendingRemoteChanges: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
    }
}

function conflictResolutionState(
    pendingConflicts: {
        fileName: string
        localContent: string | null
        remoteContent: string | null
        localModifiedAt?: number
        remoteModifiedAt?: number
        lastSyncedAt?: number
        localClean?: boolean
    }[]
) {
    return {
        mode: "conflict_resolution" as const,
        socket: mockSocket,
        pendingConflicts,
        pendingRemoteChanges: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
    }
}

describe("Code Link", () => {
    // FIRST-TIME SYNC
    // When CLI connects to a project for the first time

    describe("First-Time Sync", () => {
        it("downloads new files from Framer", () => {
            const state = snapshotProcessingState()
            const result = transition(state, {
                type: "CONFLICTS_DETECTED",
                conflicts: [],
                safeWrites: [
                    { name: "Button.tsx", content: "export const Button = () => <button/>", modifiedAt: Date.now() },
                ],
                localOnly: [],
            })

            expect(result.state.mode).toBe("watching")
            expect(result.effects.some(e => e.type === "WRITE_FILES")).toBe(true)
        })

        it("uploads new local files to Framer", () => {
            const state = snapshotProcessingState()
            const result = transition(state, {
                type: "CONFLICTS_DETECTED",
                conflicts: [],
                safeWrites: [],
                localOnly: [
                    {
                        name: "LocalComponent.tsx",
                        content: "export const Local = () => <div/>",
                        modifiedAt: Date.now(),
                    },
                ],
            })

            expect(result.state.mode).toBe("watching")
            const sendEffects = result.effects.filter(e => e.type === "SEND_MESSAGE")
            expect(
                sendEffects.some(
                    e => "payload" in e && (e as { payload: { type: string } }).payload.type === "file-change"
                )
            ).toBe(true)
        })

        it("detects conflicts when both sides have different content", () => {
            const state = snapshotProcessingState()
            const conflict = {
                fileName: "Shared.tsx",
                localContent: "local version",
                remoteContent: "framer version",
                localModifiedAt: Date.now(),
                remoteModifiedAt: Date.now() + 1000,
            }

            const result = transition(state, {
                type: "CONFLICTS_DETECTED",
                conflicts: [conflict],
                safeWrites: [],
                localOnly: [],
            })

            expect(result.state.mode).toBe("conflict_resolution")
            expect(result.effects.some(e => e.type === "REQUEST_CONFLICT_VERSIONS")).toBe(true)
        })
    })

    // RECONNECT AFTER OFFLINE
    // The 4 permutations: nothing changed, local only, remote only, both changed

    describe("Reconnect After Offline", () => {
        it("no-op when nothing changed on either side", () => {
            const state = snapshotProcessingState()
            const result = transition(state, {
                type: "CONFLICTS_DETECTED",
                conflicts: [],
                safeWrites: [],
                localOnly: [],
            })

            expect(result.state.mode).toBe("watching")
            expect(result.effects.filter(e => e.type === "WRITE_FILES")).toHaveLength(0)
            expect(result.effects.filter(e => e.type === "SEND_MESSAGE")).toHaveLength(0)
            expect(result.effects.some(e => e.type === "PERSIST_STATE")).toBe(true)
        })

        it("auto-uploads when only local changed", () => {
            // Local edited, remote unchanged since last sync → upload local without prompt
            const conflict = {
                fileName: "Test.tsx",
                localContent: "edited locally",
                remoteContent: "unchanged in framer",
                lastSyncedAt: 5_000,
                localClean: false, // local was modified
            }
            const state = conflictResolutionState([conflict])

            const result = transition(state, {
                type: "CONFLICT_VERSION_RESPONSE",
                versions: [{ fileName: "Test.tsx", latestRemoteVersionMs: 5_000 }], // remote unchanged
            })

            expect(result.state.mode).toBe("watching")
            expect(result.effects.some(e => e.type === "SEND_LOCAL_CHANGE")).toBe(true)
            expect(result.effects.some(e => e.type === "PERSIST_STATE")).toBe(true)
        })

        it("auto-downloads when only remote changed", () => {
            // Remote edited, local unchanged since last sync → download remote without prompt
            const conflict = {
                fileName: "Test.tsx",
                localContent: "unchanged locally",
                remoteContent: "edited in framer",
                lastSyncedAt: 5_000,
                localClean: true, // local matches last sync
            }
            const state = conflictResolutionState([conflict])

            const result = transition(state, {
                type: "CONFLICT_VERSION_RESPONSE",
                versions: [{ fileName: "Test.tsx", latestRemoteVersionMs: 10_000 }], // remote changed
            })

            expect(result.state.mode).toBe("watching")
            expect(result.effects.some(e => e.type === "WRITE_FILES")).toBe(true)
            expect(result.effects.some(e => e.type === "PERSIST_STATE")).toBe(true)
        })

        it("shows conflict UI when both sides changed", () => {
            // Both edited → must ask user which to keep
            const syncTime = 5_000
            const conflict = {
                fileName: "Test.tsx",
                localContent: "edited locally",
                remoteContent: "edited in framer",
                lastSyncedAt: syncTime,
                localClean: false, // local was modified
            }
            const state = conflictResolutionState([conflict])

            const result = transition(state, {
                type: "CONFLICT_VERSION_RESPONSE",
                // Remote changed well after sync (beyond drift threshold)
                versions: [{ fileName: "Test.tsx", latestRemoteVersionMs: syncTime + DEFAULT_REMOTE_DRIFT_MS + 1000 }],
            })

            expect(result.state.mode).toBe("conflict_resolution")
            expect(result.effects.some(e => e.type === "REQUEST_CONFLICT_DECISIONS")).toBe(true)
        })
    })

    // LIVE EDITING
    // Real-time sync during active editing session

    describe("Live Editing", () => {
        it("pushes local saves to Framer", () => {
            const state = watchingState()
            const result = transition(state, {
                type: "WATCHER_EVENT",
                event: {
                    kind: "change",
                    relativePath: "Button.tsx",
                    content: "export const Button = () => <button>Click</button>",
                },
            })

            expect(result.effects.some(e => e.type === "SEND_LOCAL_CHANGE")).toBe(true)
            const effect = result.effects.find(e => e.type === "SEND_LOCAL_CHANGE")
            expect(effect).toMatchObject({ fileName: "Button.tsx" })
        })

        it("pulls Framer edits to disk", () => {
            const state = watchingState()
            const result = transition(state, {
                type: "REMOTE_FILE_CHANGE",
                file: { name: "Button.tsx", content: "updated from framer", modifiedAt: Date.now() },
            })

            expect(result.effects.some(e => e.type === "WRITE_FILES")).toBe(true)
        })

        it("queues changes during initial sync", () => {
            // Changes arriving during snapshot processing are queued, not applied immediately
            const state = snapshotProcessingState()
            const result = transition(state, {
                type: "REMOTE_FILE_CHANGE",
                file: { name: "Button.tsx", content: "late arrival", modifiedAt: Date.now() },
            })

            expect(result.state.pendingRemoteChanges).toHaveLength(1)
            expect(result.effects.some(e => e.type === "WRITE_FILES")).toBe(false)
        })

        it("creates new local file and uploads to Framer", () => {
            const state = watchingState()
            const result = transition(state, {
                type: "WATCHER_EVENT",
                event: {
                    kind: "add",
                    relativePath: "NewComponent.tsx",
                    content: "export const New = () => <div>New</div>",
                },
            })

            expect(result.effects.some(e => e.type === "SEND_LOCAL_CHANGE")).toBe(true)
        })
    })

    // FOLDER STRUCTURES
    // Nested paths like components/Button.tsx

    describe("Folder Structures", () => {
        it("downloads files to nested paths", () => {
            const state = snapshotProcessingState()
            const result = transition(state, {
                type: "CONFLICTS_DETECTED",
                conflicts: [],
                safeWrites: [
                    {
                        name: "components/Button.tsx",
                        content: "export const Button = () => <button/>",
                        modifiedAt: Date.now(),
                    },
                ],
                localOnly: [],
            })

            expect(result.state.mode).toBe("watching")
            const writeEffect = result.effects.find(e => e.type === "WRITE_FILES")
            expect(writeEffect).toMatchObject({
                files: [{ name: "components/Button.tsx" }],
            })
        })

        it("uploads local files from subdirectories", () => {
            const state = snapshotProcessingState()
            const result = transition(state, {
                type: "CONFLICTS_DETECTED",
                conflicts: [],
                safeWrites: [],
                localOnly: [
                    {
                        name: "hooks/useAuth.ts",
                        content: "export function useAuth() {}",
                        modifiedAt: Date.now(),
                    },
                ],
            })

            expect(result.state.mode).toBe("watching")
            const sendEffects = result.effects.filter(e => e.type === "SEND_MESSAGE")
            expect(
                sendEffects.some(
                    e =>
                        "payload" in e &&
                        (e as { payload: { fileName?: string } }).payload.fileName === "hooks/useAuth.ts"
                )
            ).toBe(true)
        })

        it("handles watcher events for nested paths", () => {
            const state = watchingState()
            const result = transition(state, {
                type: "WATCHER_EVENT",
                event: {
                    kind: "change",
                    relativePath: "components/ui/Card.tsx",
                    content: "export const Card = () => <div/>",
                },
            })

            const effect = result.effects.find(e => e.type === "SEND_LOCAL_CHANGE")
            expect(effect).toMatchObject({ fileName: "components/ui/Card.tsx" })
        })

        it("handles remote changes to nested paths", () => {
            const state = watchingState()
            const result = transition(state, {
                type: "REMOTE_FILE_CHANGE",
                file: {
                    name: "lib/utils/format.ts",
                    content: "export function format() {}",
                    modifiedAt: Date.now(),
                },
            })

            expect(result.effects.some(e => e.type === "WRITE_FILES")).toBe(true)
        })

        it("handles deletions of nested files", () => {
            const state = watchingState()
            const result = transition(state, {
                type: "REMOTE_FILE_DELETE",
                fileName: "components/deprecated/OldButton.tsx",
            })

            const effect = result.effects.find(e => e.type === "DELETE_LOCAL_FILES")
            expect(effect).toMatchObject({ names: ["components/deprecated/OldButton.tsx"] })
        })
    })

    // DELETION HANDLING
    // Asymmetric by design: Framer is source of truth

    describe("Deletion Handling", () => {
        it("auto-applies Framer deletions locally", () => {
            // Framer delete → immediately delete local (Local likely has version control, undos are easier)
            const state = watchingState()
            const result = transition(state, {
                type: "REMOTE_FILE_DELETE",
                fileName: "Removed.tsx",
            })

            expect(result.effects.some(e => e.type === "DELETE_LOCAL_FILES")).toBe(true)
            expect(result.effects.some(e => e.type === "PERSIST_STATE")).toBe(true)
            const effect = result.effects.find(e => e.type === "DELETE_LOCAL_FILES")
            expect(effect).toMatchObject({ names: ["Removed.tsx"] })
        })

        it("prompts before propagating local deletes to Framer", () => {
            // Local delete → ask user "Delete from Framer too?" (Must confirm as deletions in Framer as permanent)
            const state = watchingState()
            const result = transition(state, {
                type: "WATCHER_EVENT",
                event: { kind: "delete", relativePath: "Deleted.tsx" },
            })

            expect(result.effects.some(e => e.type === "LOCAL_INITIATED_FILE_DELETE")).toBe(true)
            // Should NOT immediately send delete to Framer
            expect(
                result.effects.some(
                    e =>
                        e.type === "SEND_MESSAGE" &&
                        "payload" in e &&
                        (e as { payload: { type: string } }).payload.type === "file-delete"
                )
            ).toBe(false)
        })

        it("deletes from Framer after user confirms", () => {
            const state = watchingState()
            const result = transition(state, {
                type: "LOCAL_DELETE_APPROVED",
                fileName: "Deleted.tsx",
            })

            expect(result.effects.some(e => e.type === "DELETE_LOCAL_FILES")).toBe(true)
            expect(result.effects.some(e => e.type === "PERSIST_STATE")).toBe(true)
        })

        it("restores file when user cancels local delete", () => {
            const state = watchingState()
            const result = transition(state, {
                type: "LOCAL_DELETE_REJECTED",
                fileName: "Restored.tsx",
                content: "export const Restored = () => <div>Back!</div>",
            })

            expect(result.effects.some(e => e.type === "WRITE_FILES")).toBe(true)
            const effect = result.effects.find(e => e.type === "WRITE_FILES")
            expect(effect).toMatchObject({ files: [{ name: "Restored.tsx" }] })
        })
    })

    // CONFLICT RESOLUTION
    // User picks which version to keep for all conflicts

    describe("Conflict Resolution", () => {
        it("applies all Framer versions when user picks remote", () => {
            const state = conflictResolutionState([
                {
                    fileName: "A.tsx",
                    localContent: "local A",
                    remoteContent: "framer A",
                    localModifiedAt: Date.now(),
                    remoteModifiedAt: Date.now(),
                },
                {
                    fileName: "B.tsx",
                    localContent: "local B",
                    remoteContent: "framer B",
                    localModifiedAt: Date.now(),
                    remoteModifiedAt: Date.now(),
                },
            ])

            const result = transition(state, { type: "CONFLICTS_RESOLVED", resolution: "remote" })

            expect(result.state.mode).toBe("watching")
            expect(result.effects.some(e => e.type === "PERSIST_STATE")).toBe(true)
            const writes = result.effects.filter(e => e.type === "WRITE_FILES")
            expect(writes).toHaveLength(2)
        })

        it("uploads all local versions when user picks local", () => {
            const state = conflictResolutionState([
                {
                    fileName: "A.tsx",
                    localContent: "local A",
                    remoteContent: "framer A",
                    localModifiedAt: Date.now(),
                    remoteModifiedAt: Date.now(),
                },
                {
                    fileName: "B.tsx",
                    localContent: "local B",
                    remoteContent: "framer B",
                    localModifiedAt: Date.now(),
                    remoteModifiedAt: Date.now(),
                },
            ])

            const result = transition(state, { type: "CONFLICTS_RESOLVED", resolution: "local" })

            expect(result.state.mode).toBe("watching")
            const sends = result.effects.filter(e => e.type === "SEND_MESSAGE")
            expect(sends).toHaveLength(2)
        })

        it("handles deletions within conflicts - remote deleted, local has content", () => {
            const state = conflictResolutionState([
                { fileName: "Deleted.tsx", localContent: "still here locally", remoteContent: null, localClean: false },
            ])

            const result = transition(state, { type: "CONFLICTS_RESOLVED", resolution: "remote" })

            // Remote is null → delete locally
            expect(result.effects.some(e => e.type === "DELETE_LOCAL_FILES")).toBe(true)
        })

        it("handles deletion within conflicts - local deleted, remote has content", () => {
            const state = conflictResolutionState([
                { fileName: "Deleted.tsx", localContent: null, remoteContent: "still in framer" },
            ])

            const result = transition(state, { type: "CONFLICTS_RESOLVED", resolution: "local" })

            // Local is null → request delete confirmation (don't auto-delete from Framer)
            expect(result.effects.some(e => e.type === "LOCAL_INITIATED_FILE_DELETE")).toBe(true)
        })
    })

    // ECHO PREVENTION
    // Avoid infinite sync loops by tracking what we just sent/received

    describe("Echo Prevention", () => {
        it("skips inbound changes matching last outbound", () => {
            const tracker = createHashTracker()
            tracker.remember("Button.tsx", "content we just sent")

            const filtered = filterEchoedFiles(
                [{ name: "Button.tsx", content: "content we just sent", modifiedAt: Date.now() }],
                tracker
            )

            expect(filtered).toHaveLength(0)
        })

        it("applies inbound changes with different content", () => {
            const tracker = createHashTracker()
            tracker.remember("Button.tsx", "old content")

            const filtered = filterEchoedFiles(
                [{ name: "Button.tsx", content: "new content from framer", modifiedAt: Date.now() }],
                tracker
            )

            expect(filtered).toHaveLength(1)
        })
    })

    // EDGE CASES
    // Robustness: wrong modes, disconnected states, case sensitivity

    describe("Edge Cases", () => {
        it("ignores local changes when disconnected", () => {
            const state = disconnectedState()
            const result = transition(state, {
                type: "WATCHER_EVENT",
                event: { kind: "change", relativePath: "Test.tsx", content: "content" },
            })

            expect(result.effects.some(e => e.type === "SEND_LOCAL_CHANGE")).toBe(false)
        })

        it("ignores local changes during handshake", () => {
            const state = handshakingState()
            const result = transition(state, {
                type: "WATCHER_EVENT",
                event: { kind: "change", relativePath: "Test.tsx", content: "content" },
            })

            expect(result.effects.some(e => e.type === "SEND_LOCAL_CHANGE")).toBe(false)
        })

        it("rejects remote deletions while disconnected", () => {
            const state = disconnectedState()
            const result = transition(state, {
                type: "REMOTE_FILE_DELETE",
                fileName: "Test.tsx",
            })

            expect(result.effects.some(e => e.type === "DELETE_LOCAL_FILES")).toBe(false)
        })

        it("ignores conflict resolution when not in conflict mode", () => {
            const state = watchingState()
            const result = transition(state, {
                type: "CONFLICTS_RESOLVED",
                resolution: "remote",
            })

            expect(result.effects.some(e => e.type === "LOG" && e.level === "warn")).toBe(true)
        })

        it("persists state on disconnect", () => {
            const state = watchingState()
            const result = transition(state, { type: "DISCONNECT" })

            expect(result.state.mode).toBe("disconnected")
            expect(result.effects.some(e => e.type === "PERSIST_STATE")).toBe(true)
        })
    })

    // CONNECTION LIFECYCLE
    // Handshake flow and state transitions

    describe("Connection Lifecycle", () => {
        it("transitions disconnected → handshaking on connect", () => {
            const state = disconnectedState()
            const result = transition(state, {
                type: "HANDSHAKE",
                socket: mockSocket,
                projectInfo: { projectId: "abc123", projectName: "My Project" },
            })

            expect(result.state.mode).toBe("handshaking")
            expect(result.effects.some(e => e.type === "INIT_WORKSPACE")).toBe(true)
            expect(result.effects.some(e => e.type === "SEND_MESSAGE")).toBe(true)
        })

        it("requests file list after handshake", () => {
            const state = disconnectedState()
            const result = transition(state, {
                type: "HANDSHAKE",
                socket: mockSocket,
                projectInfo: { projectId: "abc123", projectName: "My Project" },
            })

            const sendEffect = result.effects.find(e => e.type === "SEND_MESSAGE")
            expect(sendEffect).toMatchObject({ payload: { type: "request-files" } })
        })

        it("transitions handshaking → snapshot_processing on file list", () => {
            const state = handshakingState()
            const result = transition(state, {
                type: "REMOTE_FILE_LIST",
                files: [{ name: "Test.tsx", content: "content", modifiedAt: Date.now() }],
            })

            expect(result.state.mode).toBe("snapshot_processing")
            expect(result.effects.some(e => e.type === "DETECT_CONFLICTS")).toBe(true)
        })
    })
})
