import { describe, expect, it } from "vitest"
import { modeFromSyncMode } from "./sync-mode"

describe("modeFromSyncMode", () => {
    it("maps in-progress CLI phases to syncing", () => {
        expect(modeFromSyncMode("handshaking")).toBe("syncing")
        expect(modeFromSyncMode("snapshot_processing")).toBe("syncing")
        expect(modeFromSyncMode("conflict_resolution")).toBe("syncing")
    })

    it("maps watching to idle", () => {
        expect(modeFromSyncMode("watching")).toBe("idle")
    })

    it("falls back to loading when sync mode is unknown locally", () => {
        expect(modeFromSyncMode(null)).toBe("loading")
    })
})
