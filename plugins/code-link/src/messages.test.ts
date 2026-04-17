import { describe, expect, it, vi } from "vitest"
import { createMessageHandler } from "./messages"

describe("createMessageHandler", () => {
    it("dispatches remote sync mode updates", async () => {
        const dispatch = vi.fn()
        const api = {
            publishSnapshot: vi.fn(),
            applyRemoteChange: vi.fn(),
            applyRemoteRename: vi.fn(),
            applyRemoteDelete: vi.fn(),
            fetchConflictVersions: vi.fn(),
            readCurrentContent: vi.fn(),
            remember: vi.fn(),
            forget: vi.fn(),
        }

        const handleMessage = createMessageHandler({
            dispatch,
            api: api as never,
        })

        await handleMessage({ type: "sync-mode", mode: "snapshot_processing" }, {} as WebSocket)

        expect(dispatch).toHaveBeenCalledWith({
            type: "sync-mode",
            syncMode: "snapshot_processing",
        })
    })
})
