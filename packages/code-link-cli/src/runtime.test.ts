import { describe, expect, it } from "vitest"
import { SyncRuntime } from "./runtime.ts"

describe("SyncRuntime prompt state", () => {
    it("merges delete prompts into the active session without duplicating files", () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()

        const first = runtime.startDeletePrompt(["A.tsx"])
        const second = runtime.startDeletePrompt(["A.tsx", "B.tsx"])

        expect(first?.session).toEqual(second?.session)
        expect(second?.fileNames).toEqual(["B.tsx"])
    })

    it("keeps conflicts live by path inside one active session", () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()

        const first = runtime.startOrUpdateConflictPrompt([
            { fileName: "A.tsx", localContent: "local 1", remoteContent: "remote" },
        ])
        const second = runtime.startOrUpdateConflictPrompt([
            { fileName: "A.tsx", localContent: "local 2", remoteContent: "remote" },
            { fileName: "B.tsx", localContent: "local", remoteContent: "remote" },
        ])

        expect(first?.session).toEqual(second?.session)
        expect(second?.conflicts).toEqual([
            { fileName: "A.tsx", localContent: "local 2", remoteContent: "remote" },
            { fileName: "B.tsx", localContent: "local", remoteContent: "remote" },
        ])
    })

    it("does not keep resolved conflicts in the active prompt", () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()

        const prompt = runtime.startOrUpdateConflictPrompt([
            { fileName: "A.tsx", localContent: "same", remoteContent: "same" },
            { fileName: "B.tsx", localContent: "local", remoteContent: "remote" },
        ])

        expect(prompt?.conflicts).toEqual([{ fileName: "B.tsx", localContent: "local", remoteContent: "remote" }])
    })

    it("removes a live conflict when both sides converge", () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()
        const prompt = runtime.startOrUpdateConflictPrompt([
            { fileName: "A.tsx", localContent: "local", remoteContent: "remote" },
            { fileName: "B.tsx", localContent: "local", remoteContent: "remote" },
        ])
        if (!prompt) throw new Error("Expected prompt")

        const change = runtime.updateActiveConflictRemote("A.tsx", "local", 123)

        expect(change).toEqual({
            changed: true,
            session: prompt.session,
            conflicts: [{ fileName: "B.tsx", localContent: "local", remoteContent: "remote" }],
            cleared: false,
            resolved: [{ fileName: "A.tsx", content: "local", modifiedAt: 123 }],
        })
        expect(runtime.isActiveConflictPath("A.tsx")).toBe(false)
        expect(runtime.isActiveConflictPath("B.tsx")).toBe(true)
    })

    it("clears the active conflict prompt when the final conflict converges", () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()
        const prompt = runtime.startOrUpdateConflictPrompt([
            { fileName: "A.tsx", localContent: "local", remoteContent: "remote" },
        ])
        if (!prompt) throw new Error("Expected prompt")

        const change = runtime.updateActiveConflictLocal("A.tsx", "remote", 456)

        expect(change).toEqual({
            changed: true,
            session: prompt.session,
            conflicts: [],
            cleared: true,
            resolved: [{ fileName: "A.tsx", content: "remote", modifiedAt: 456 }],
        })
        expect(runtime.getActiveConflictPrompt()).toBeNull()
    })

    it("invalidates stale delete prompt paths and keeps remaining paths in the same session", () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()
        const prompt = runtime.startDeletePrompt(["A.tsx", "B.tsx"])
        if (!prompt) throw new Error("Expected delete prompt")

        const change = runtime.invalidateDeletePromptPath("A.tsx")

        expect(change).toEqual({
            changed: true,
            session: prompt.session,
            fileNames: ["A.tsx"],
            cleared: false,
        })
        expect(runtime.getDeletePromptFileNames(prompt.session, ["A.tsx", "B.tsx"])).toEqual(["B.tsx"])
    })

    it("rejects stale prompt sessions as plain data checks", () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()
        const prompt = runtime.startOrUpdateConflictPrompt([
            { fileName: "A.tsx", localContent: "local", remoteContent: "remote" },
        ])
        if (!prompt) throw new Error("Expected prompt")

        expect(
            runtime.getConflictPromptConflicts({ connectionId: prompt.session.connectionId + 1, promptId: "stale" }, [
                "A.tsx",
            ])
        ).toBeNull()
    })
})

describe("SyncRuntime pending sync-complete", () => {
    it("returns empty when no sync-complete is pending", () => {
        const runtime = new SyncRuntime()

        expect(runtime.checkPendingSyncComplete()).toEqual({ is: "empty" })
    })

    it("merges pending sync-complete payloads and clears them when ready", () => {
        const runtime = new SyncRuntime()
        runtime.addPendingSyncComplete({ totalCount: 1, updatedCount: 1, unchangedCount: 0 })
        runtime.addPendingSyncComplete({ totalCount: 2, updatedCount: 1, unchangedCount: 1 })

        expect(runtime.checkPendingSyncComplete()).toEqual({
            is: "ready",
            payload: { totalCount: 3, updatedCount: 2, unchangedCount: 1 },
        })
        expect(runtime.checkPendingSyncComplete()).toEqual({ is: "empty" })
    })

    it("keeps pending sync-complete blocked while prompts are active", () => {
        const runtime = new SyncRuntime()
        runtime.mintConnectionId()
        const prompt = runtime.startDeletePrompt(["A.tsx"])
        if (!prompt) throw new Error("Expected delete prompt")

        runtime.addPendingSyncComplete({ totalCount: 1, updatedCount: 1, unchangedCount: 0 })

        expect(runtime.checkPendingSyncComplete()).toEqual({ is: "blocked" })
        runtime.clearDeletePromptFiles(prompt.session, ["A.tsx"])
        expect(runtime.checkPendingSyncComplete()).toEqual({
            is: "ready",
            payload: { totalCount: 1, updatedCount: 1, unchangedCount: 0 },
        })
    })
})
