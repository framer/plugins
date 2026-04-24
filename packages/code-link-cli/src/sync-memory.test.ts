import { describe, expect, it } from "vitest"
import { SyncMemory } from "./sync-memory.ts"

describe("SyncMemory invariants", () => {
    it("normalizes paths for content echoes", () => {
        const memory = new SyncMemory()

        memory.armContentEcho("Button", "x")

        expect(memory.matchesContentEcho("Button.tsx", "x")).toBe(true)
        expect(memory.isContentEcho("Button.tsx", "x")).toBe(true)
    })

    it("rolls back a prepared write echo only when it still matches that write", () => {
        const memory = new SyncMemory()
        const first = memory.armContentEcho("A.tsx", "first")
        memory.armContentEcho("A.tsx", "second")

        memory.rollbackWriteFailure(first)

        expect(memory.matchesContentEcho("A.tsx", "second")).toBe(true)
    })

    it("keeps expected delete echoes separate from agreed delete metadata", () => {
        const memory = new SyncMemory()
        const prepared = memory.armExpectedDeleteEcho("A.tsx")

        expect(memory.matchesExpectedDeleteEcho("A.tsx")).toBe(true)

        memory.rollbackExpectedDeleteEcho(prepared)

        expect(memory.matchesExpectedDeleteEcho("A.tsx")).toBe(false)
    })

    it("records agreed content and deletes through one API", () => {
        const memory = new SyncMemory()

        memory.recordSyncedContent("A.tsx", "x", 123)
        expect(memory.matchesAgreedContent("A.tsx", "x")).toBe(true)

        memory.recordSyncedDelete("A.tsx")
        expect(memory.metadataFor("A.tsx")).toBeUndefined()
    })
})
