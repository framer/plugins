import { describe, it, expect } from "vitest"
import { transition } from "./controller.js"
import { createHashTracker } from "./utils/hash-tracker.js"

import type { WebSocket } from "ws"
import { filterEchoedFiles } from "./helpers/files.js"
describe("State Machine", () => {
  describe("HANDSHAKE transition", () => {
    it("transitions from disconnected to handshaking", () => {
      const initialState = {
        mode: "disconnected" as const,
        socket: null,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const mockSocket = {} as WebSocket
      const result = transition(initialState, {
        type: "HANDSHAKE",
        socket: mockSocket,
        projectInfo: { projectId: "test-id", projectName: "Test Project" },
      })

      expect(result.state.mode).toBe("handshaking")
      expect(result.state.socket).toBe(mockSocket)
      expect(result.effects).toHaveLength(3)
      expect(result.effects[0]).toMatchObject({ type: "INIT_WORKSPACE" })
      expect(result.effects[1]).toMatchObject({ type: "LOAD_PERSISTED_STATE" })
      expect(result.effects[2]).toMatchObject({
        type: "SEND_MESSAGE",
        payload: { type: "request-files" },
      })
    })

    it("ignores handshake when not in disconnected mode", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "HANDSHAKE",
        socket: {} as WebSocket,
        projectInfo: { projectId: "test-id", projectName: "Test Project" },
      })

      expect(result.state.mode).toBe("watching")
      expect(result.effects).toHaveLength(1)
      expect(result.effects[0]).toMatchObject({
        type: "LOG",
        level: "warn",
      })
    })
  })

  describe("DISCONNECT transition", () => {
    it("transitions to disconnected and persists state", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map([
          [
            "Test.tsx",
            {
              localHash: "abc123",
              lastSyncedHash: "abc123",
              lastRemoteTimestamp: Date.now(),
            },
          ],
        ]),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, { type: "DISCONNECT" })

      expect(result.state.mode).toBe("disconnected")
      expect(result.state.socket).toBe(null)
      expect(result.effects).toHaveLength(2)
      expect(result.effects[0]).toMatchObject({ type: "PERSIST_STATE" })
      expect(result.effects[1]).toMatchObject({
        type: "LOG",
        level: "debug",
      })
    })
  })

  describe("FILE_LIST transition", () => {
    it("transitions to snapshot_processing and emits DETECT_CONFLICTS", () => {
      const initialState = {
        mode: "handshaking" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const remoteFiles = [
        { name: "Test.tsx", content: "remote content", modifiedAt: Date.now() },
      ]

      const result = transition(initialState, {
        type: "FILE_LIST",
        files: remoteFiles,
      })

      expect(result.state.mode).toBe("snapshot_processing")
      expect(result.state.queuedDiffs).toEqual(remoteFiles)
      expect(result.effects).toHaveLength(2)
      expect(result.effects[0]).toMatchObject({
        type: "LOG",
        level: "debug",
      })
      expect(result.effects[1]).toMatchObject({
        type: "DETECT_CONFLICTS",
        remoteFiles,
      })
    })

    it("ignores FILE_LIST when not in handshaking mode", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "FILE_LIST",
        files: [],
      })

      expect(result.state.mode).toBe("watching")
      expect(result.effects).toHaveLength(1)
      expect(result.effects[0]).toMatchObject({
        type: "LOG",
        level: "warn",
      })
    })
  })

  describe("CONFLICTS_DETECTED transition", () => {
    it("applies safe writes and transitions to watching when no conflicts", () => {
      // detectConflicts already did auto-resolution, so we just get safeWrites
      const initialState = {
        mode: "snapshot_processing" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "CONFLICTS_DETECTED",
        conflicts: [], // No conflicts - detectConflicts already resolved them
        safeWrites: [
          {
            name: "Test.tsx",
            content: "new content",
            modifiedAt: Date.now(),
          },
        ],
        localOnly: [],
      })

      expect(result.state.mode).toBe("watching")
      expect("pendingConflicts" in result.state).toBe(false)
      // Should have logs + WRITE_FILES + PERSIST_STATE
      expect(result.effects.length).toBeGreaterThan(2)
      expect(result.effects.some((e) => e.type === "WRITE_FILES")).toBe(true)
      expect(result.effects.some((e) => e.type === "PERSIST_STATE")).toBe(true)
    })

    it("transitions to conflict_resolution when manual conflicts exist", () => {
      // detectConflicts returns conflicts when both sides changed
      const initialState = {
        mode: "snapshot_processing" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const conflict = {
        fileName: "Test.tsx",
        localContent: "local content",
        remoteContent: "remote content",
        localModifiedAt: Date.now(),
        remoteModifiedAt: Date.now() + 1000,
      }

      const result = transition(initialState, {
        type: "CONFLICTS_DETECTED",
        conflicts: [conflict],
        safeWrites: [],
        localOnly: [],
      })

      expect(result.state.mode).toBe("conflict_resolution")
      if (result.state.mode === "conflict_resolution") {
        expect(result.state.pendingConflicts).toHaveLength(1)
      }
      expect(
        result.effects.some((e) => e.type === "REQUEST_CONFLICT_VERSIONS")
      ).toBe(true)
    })
  })

  describe("FILE_CHANGE transition", () => {
    it("applies changes immediately in watching mode", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const file = {
        name: "Test.tsx",
        content: "new content",
        modifiedAt: Date.now(),
      }

      const result = transition(initialState, {
        type: "FILE_CHANGE",
        file,
      })

      expect(result.state.mode).toBe("watching")
      expect(result.effects.some((e) => e.type === "WRITE_FILES")).toBe(true)
    })

    it("queues changes during snapshot processing", () => {
      const initialState = {
        mode: "snapshot_processing" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const file = {
        name: "Test.tsx",
        content: "new content",
        modifiedAt: Date.now(),
      }

      const result = transition(initialState, {
        type: "FILE_CHANGE",
        file,
      })

      expect(result.state.mode).toBe("snapshot_processing")
      expect(result.state.queuedDiffs).toHaveLength(1)
      expect(result.state.queuedDiffs[0]).toEqual(file)
      expect(result.effects.some((e) => e.type === "WRITE_FILES")).toBe(false)
    })
  })

  describe("REMOTE_FILE_DELETE transition", () => {
    it("applies delete immediately in watching mode", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map([
          [
            "Test.tsx",
            {
              localHash: "abc123",
              lastSyncedHash: "abc123",
              lastRemoteTimestamp: Date.now(),
            },
          ],
        ]),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "REMOTE_FILE_DELETE",
        fileName: "Test.tsx",
      })

      expect(result.state.mode).toBe("watching")
      expect(result.effects.some((e) => e.type === "DELETE_LOCAL_FILES")).toBe(
        true
      )
      const deleteEffect = result.effects.find(
        (e) => e.type === "DELETE_LOCAL_FILES"
      )
      expect(deleteEffect).toMatchObject({
        type: "DELETE_LOCAL_FILES",
        names: ["Test.tsx"],
      })
      expect(result.effects.some((e) => e.type === "PERSIST_STATE")).toBe(true)
    })

    it("applies deletes immediately during snapshot processing", () => {
      const initialState = {
        mode: "snapshot_processing" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "REMOTE_FILE_DELETE",
        fileName: "Test.tsx",
      })

      expect(result.state.mode).toBe("snapshot_processing")
      expect(result.effects.some((e) => e.type === "DELETE_LOCAL_FILES")).toBe(
        true
      )
      expect(result.effects.some((e) => e.type === "LOG")).toBe(true)
    })

    it("rejects deletes while disconnected", () => {
      const initialState = {
        mode: "disconnected" as const,
        socket: null,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "REMOTE_FILE_DELETE",
        fileName: "Test.tsx",
      })

      expect(result.state.mode).toBe("disconnected")
      expect(result.effects.some((e) => e.type === "DELETE_LOCAL_FILES")).toBe(
        false
      )
      expect(
        result.effects.some((e) => e.type === "LOG" && e.level === "warn")
      ).toBe(true)
    })
  })

  describe("REMOTE_DELETE_CONFIRMED transition", () => {
    it("applies the delete and persists state", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map([
          [
            "Test.tsx",
            {
              localHash: "abc123",
              lastSyncedHash: "abc123",
              lastRemoteTimestamp: Date.now(),
            },
          ],
        ]),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "REMOTE_DELETE_CONFIRMED",
        fileName: "Test.tsx",
      })

      expect(result.state.mode).toBe("watching")
      expect(result.effects.some((e) => e.type === "DELETE_LOCAL_FILES")).toBe(
        true
      )
      expect(result.effects.some((e) => e.type === "PERSIST_STATE")).toBe(true)
    })
  })

  describe("REMOTE_DELETE_CANCELLED transition", () => {
    it("restores the file", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "REMOTE_DELETE_CANCELLED",
        fileName: "Test.tsx",
        content: "restored content",
      })

      expect(result.state.mode).toBe("watching")
      expect(result.effects.some((e) => e.type === "WRITE_FILES")).toBe(true)
      const writeEffect = result.effects.find((e) => e.type === "WRITE_FILES")
      expect(writeEffect).toMatchObject({
        type: "WRITE_FILES",
        files: [
          {
            name: "Test.tsx",
            content: "restored content",
          },
        ],
      })
    })
  })

  describe("REQUEST_FILES transition", () => {
    it("emits LIST_LOCAL_FILES effect when in watching mode", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "REQUEST_FILES",
      })

      expect(result.state.mode).toBe("watching")
      expect(result.effects.some((e) => e.type === "LIST_LOCAL_FILES")).toBe(
        true
      )
    })

    it("rejects request when disconnected", () => {
      const initialState = {
        mode: "disconnected" as const,
        socket: null,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "REQUEST_FILES",
      })

      expect(result.state.mode).toBe("disconnected")
      expect(result.effects.some((e) => e.type === "LIST_LOCAL_FILES")).toBe(
        false
      )
      expect(
        result.effects.some((e) => e.type === "LOG" && e.level === "warn")
      ).toBe(true)
    })
  })

  describe("WATCHER_EVENT transition", () => {
    it("emits SEND_LOCAL_CHANGE for file add/change in watching mode", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "WATCHER_EVENT",
        event: {
          kind: "change",
          relativePath: "Test.tsx",
          content: "export const Test = () => <div>Test</div>",
        },
      })

      expect(result.state.mode).toBe("watching")
      expect(result.effects.some((e) => e.type === "SEND_LOCAL_CHANGE")).toBe(
        true
      )
      const sendEffect = result.effects.find(
        (e) => e.type === "SEND_LOCAL_CHANGE"
      )
      expect(sendEffect).toMatchObject({
        type: "SEND_LOCAL_CHANGE",
        fileName: "Test.tsx",
        content: "export const Test = () => <div>Test</div>",
      })
    })

    it("emits REQUEST_LOCAL_DELETE_DECISION for file delete", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "WATCHER_EVENT",
        event: {
          kind: "delete",
          relativePath: "Test.tsx",
        },
      })

      expect(
        result.effects.some((e) => e.type === "REQUEST_LOCAL_DELETE_DECISION")
      ).toBe(true)
    })

    it("ignores events when not in watching mode", () => {
      const initialState = {
        mode: "handshaking" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "WATCHER_EVENT",
        event: {
          kind: "change",
          relativePath: "Test.tsx",
          content: "content",
        },
      })

      expect(result.effects.some((e) => e.type === "SEND_LOCAL_CHANGE")).toBe(
        false
      )
    })

    it("ignores events when disconnected", () => {
      const initialState = {
        mode: "disconnected" as const,
        socket: null,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "WATCHER_EVENT",
        event: {
          kind: "change",
          relativePath: "Test.tsx",
          content: "content",
        },
      })

      expect(result.effects.some((e) => e.type === "SEND_LOCAL_CHANGE")).toBe(
        false
      )
    })
  })

  describe("FILE_SYNCED_CONFIRMATION transition", () => {
    it("updates file metadata with remote timestamp", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map([
          [
            "Test.tsx",
            {
              baseRemoteHash: "abc123",
              lastRemoteTimestamp: 1000,
            },
          ],
        ]),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "FILE_SYNCED_CONFIRMATION",
        fileName: "Test.tsx",
        remoteModifiedAt: 2000,
      })

      expect(
        result.effects.some((e) => e.type === "UPDATE_FILE_METADATA")
      ).toBe(true)
    })

    it("creates metadata entry if file not tracked yet", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "FILE_SYNCED_CONFIRMATION",
        fileName: "NewFile.tsx",
        remoteModifiedAt: 3000,
      })
    })
  })

  describe("CONFLICTS_RESOLVED transition", () => {
    it("applies all remote versions when user picks remote", () => {
      const conflict1 = {
        fileName: "Test1.tsx",
        localContent: "local 1",
        remoteContent: "remote 1",
        localModifiedAt: Date.now(),
        remoteModifiedAt: Date.now() + 1000,
      }
      const conflict2 = {
        fileName: "Test2.tsx",
        localContent: "local 2",
        remoteContent: "remote 2",
        localModifiedAt: Date.now(),
        remoteModifiedAt: Date.now() + 1000,
      }

      const initialState = {
        mode: "conflict_resolution" as const,
        socket: {} as WebSocket,
        files: new Map(),
        pendingConflicts: [conflict1, conflict2],
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "CONFLICTS_RESOLVED",
        resolution: "remote",
      })

      expect(result.state.mode).toBe("watching")
      expect("pendingConflicts" in result.state).toBe(false)

      const writeEffects = result.effects.filter(
        (e) => e.type === "WRITE_FILES"
      )
      // Each conflict gets its own WRITE_FILES effect
      expect(writeEffects).toHaveLength(2)
      expect(writeEffects[0]).toMatchObject({
        type: "WRITE_FILES",
        files: [{ name: "Test1.tsx", content: "remote 1" }],
      })
      expect(writeEffects[1]).toMatchObject({
        type: "WRITE_FILES",
        files: [{ name: "Test2.tsx", content: "remote 2" }],
      })
      expect(result.effects.some((e) => e.type === "PERSIST_STATE")).toBe(true)
    })

    it("sends all local versions when user picks local", () => {
      const conflict1 = {
        fileName: "Test1.tsx",
        localContent: "local 1",
        remoteContent: "remote 1",
        localModifiedAt: Date.now(),
        remoteModifiedAt: Date.now() + 1000,
      }
      const conflict2 = {
        fileName: "Test2.tsx",
        localContent: "local 2",
        remoteContent: "remote 2",
        localModifiedAt: Date.now(),
        remoteModifiedAt: Date.now() + 1000,
      }

      const initialState = {
        mode: "conflict_resolution" as const,
        socket: {} as WebSocket,
        files: new Map(),
        pendingConflicts: [conflict1, conflict2],
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "CONFLICTS_RESOLVED",
        resolution: "local",
      })

      expect(result.state.mode).toBe("watching")
      expect("pendingConflicts" in result.state).toBe(false)

      const sendEffects = result.effects.filter(
        (e) => e.type === "SEND_MESSAGE"
      )
      expect(sendEffects).toHaveLength(2)
      expect(sendEffects[0]).toMatchObject({
        payload: {
          type: "file-change",
          fileName: "Test1.tsx",
          content: "local 1",
        },
      })
      expect(sendEffects[1]).toMatchObject({
        payload: {
          type: "file-change",
          fileName: "Test2.tsx",
          content: "local 2",
        },
      })
    })

    it("ignores resolution when not in conflict_resolution mode", () => {
      const initialState = {
        mode: "watching" as const,
        socket: {} as WebSocket,
        files: new Map(),
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "CONFLICTS_RESOLVED",
        resolution: "remote",
      })

      expect(result.state.mode).toBe("watching")
      expect(
        result.effects.some((e) => e.type === "LOG" && e.level === "warn")
      ).toBe(true)
    })
  })

  describe("CONFLICT_VERSION_RESPONSE transition", () => {
    it("auto-applies local changes when remote is unchanged", () => {
      const conflict = {
        fileName: "Test.tsx",
        localContent: "local content",
        remoteContent: "remote content",
        localModifiedAt: 1000,
        remoteModifiedAt: 2000,
        lastSyncedAt: 5_000,
        localClean: false,
      }

      const initialState = {
        mode: "conflict_resolution" as const,
        socket: {} as WebSocket,
        pendingConflicts: [conflict],
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "CONFLICT_VERSION_RESPONSE",
        versions: [{ fileName: "Test.tsx", latestRemoteVersionMs: 5_000 }],
      })

      expect(result.state.mode).toBe("watching")
      expect(
        result.effects.some((effect) => effect.type === "SEND_LOCAL_CHANGE")
      ).toBe(true)
      expect(
        result.effects.some((effect) => effect.type === "PERSIST_STATE")
      ).toBe(true)
    })

    it("auto-applies remote changes when local is clean", () => {
      const conflict = {
        fileName: "Test.tsx",
        localContent: "local content",
        remoteContent: "remote content",
        localModifiedAt: 1000,
        remoteModifiedAt: 2000,
        lastSyncedAt: 5_000,
        localClean: true,
      }

      const initialState = {
        mode: "conflict_resolution" as const,
        socket: {} as WebSocket,
        pendingConflicts: [conflict],
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "CONFLICT_VERSION_RESPONSE",
        versions: [{ fileName: "Test.tsx", latestRemoteVersionMs: 10_000 }],
      })

      expect(result.state.mode).toBe("watching")
      expect(
        result.effects.some((effect) => effect.type === "WRITE_FILES")
      ).toBe(true)
    })

    it("requests manual decisions when both sides changed", () => {
      const conflict = {
        fileName: "Test.tsx",
        localContent: "local content",
        remoteContent: "remote content",
        localModifiedAt: 1000,
        remoteModifiedAt: 2000,
        lastSyncedAt: 5_000,
        localClean: false,
      }

      const initialState = {
        mode: "conflict_resolution" as const,
        socket: {} as WebSocket,
        pendingConflicts: [conflict],
        queuedDiffs: [],
        pendingOperations: new Map(),
        nextOperationId: 1,
      }

      const result = transition(initialState, {
        type: "CONFLICT_VERSION_RESPONSE",
        versions: [{ fileName: "Test.tsx", latestRemoteVersionMs: 9_000 }],
      })

      expect(result.state.mode).toBe("conflict_resolution")
      expect(
        result.effects.some(
          (effect) => effect.type === "REQUEST_CONFLICT_DECISIONS"
        )
      ).toBe(true)
      if (result.state.mode === "conflict_resolution") {
        expect(result.state.pendingConflicts).toHaveLength(1)
      }
    })
  })

  describe("echo prevention filter", () => {
    it("skips inbound file-change that matches last local send", () => {
      const hashTracker = createHashTracker()
      hashTracker.remember("Hey.tsx", "content")

      const filtered = filterEchoedFiles(
        [
          {
            name: "Hey.tsx",
            content: "content",
            modifiedAt: Date.now(),
          },
        ],
        hashTracker
      )

      expect(filtered).toHaveLength(0)
    })

    it("keeps inbound change when content differs", () => {
      const hashTracker = createHashTracker()
      hashTracker.remember("Hey.tsx", "old content")

      const filtered = filterEchoedFiles(
        [
          {
            name: "Hey.tsx",
            content: "new content",
            modifiedAt: Date.now(),
          },
        ],
        hashTracker
      )

      expect(filtered).toHaveLength(1)
      expect(filtered[0]?.content).toBe("new content")
    })
  })
})
