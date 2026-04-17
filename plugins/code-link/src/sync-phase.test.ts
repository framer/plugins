import { describe, expect, it } from "vitest"
import { modeFromSyncPhase } from "./sync-phase"

describe("modeFromSyncPhase", () => {
    it("maps coarse CLI phases to UI modes", () => {
        expect(modeFromSyncPhase("initial_sync")).toBe("syncing")
        expect(modeFromSyncPhase("ready")).toBe("idle")
    })

    it("treats unknown as loading", () => {
        expect(modeFromSyncPhase(null)).toBe("loading")
    })
})
