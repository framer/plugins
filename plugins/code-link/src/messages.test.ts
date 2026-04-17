import { describe, expect, it, vi } from "vitest"
import { createMessageHandler } from "./messages"

describe("createMessageHandler", () => {
    it("dispatches sync-phase from CLI messages", async () => {
        const dispatch = vi.fn()
        const api = {
            publishSnapshot: vi.fn(),
        } as unknown as import("./api").CodeFilesAPI

        const handleMessage = createMessageHandler({ dispatch, api })

        await handleMessage({ type: "sync-phase", phase: "initial_sync" }, {} as WebSocket)

        expect(dispatch).toHaveBeenCalledWith({
            type: "sync-phase",
            syncPhase: "initial_sync",
        })
    })
})
