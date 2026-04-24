import { describe, expect, it, vi } from "vitest"
import { createMessageHandler } from "./messages"

function socket() {
    const sent: unknown[] = []
    return {
        sent,
        ws: {
            send(payload: string) {
                sent.push(JSON.parse(payload) as unknown)
            },
        } as WebSocket,
    }
}

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

    it("dispatches conflict updates with their prompt session", async () => {
        const dispatch = vi.fn()
        const api = {
            publishSnapshot: vi.fn(),
        } as unknown as import("./api").CodeFilesAPI
        const handleMessage = createMessageHandler({ dispatch, api })
        const session = { connectionId: 1, promptId: "conflicts" }

        await handleMessage(
            {
                type: "conflicts-detected",
                session,
                conflicts: [{ fileName: "A.tsx", localContent: "local", remoteContent: "remote" }],
            },
            {} as WebSocket
        )

        expect(dispatch).toHaveBeenCalledWith({
            type: "conflicts",
            session,
            conflicts: [{ fileName: "A.tsx", localContent: "local", remoteContent: "remote" }],
        })
    })

    it("dispatches conflict clears with their prompt session", async () => {
        const dispatch = vi.fn()
        const api = {
            publishSnapshot: vi.fn(),
        } as unknown as import("./api").CodeFilesAPI
        const handleMessage = createMessageHandler({ dispatch, api })
        const session = { connectionId: 1, promptId: "conflicts" }

        await handleMessage({ type: "conflicts-cleared", session }, {} as WebSocket)

        expect(dispatch).toHaveBeenCalledWith({ type: "clear-conflicts", session })
    })

    it("dispatches delete prompt clears with the invalidated file names", async () => {
        const dispatch = vi.fn()
        const api = {
            publishSnapshot: vi.fn(),
        } as unknown as import("./api").CodeFilesAPI
        const handleMessage = createMessageHandler({ dispatch, api })
        const session = { connectionId: 1, promptId: "deletes" }

        await handleMessage({ type: "delete-prompt-cleared", session, fileNames: ["A.tsx"] }, {} as WebSocket)

        expect(dispatch).toHaveBeenCalledWith({ type: "clear-pending-deletes", session, fileNames: ["A.tsx"] })
    })

    it("acknowledges delete prompt paths that are already missing in Framer", async () => {
        const dispatch = vi.fn()
        const api = {
            readCurrentContent: vi.fn(async (fileName: string) =>
                fileName === "Existing.tsx" ? "existing content" : undefined
            ),
        } as unknown as import("./api").CodeFilesAPI
        const handleMessage = createMessageHandler({ dispatch, api })
        const session = { connectionId: 1, promptId: "deletes" }
        const open = socket()

        await handleMessage(
            {
                type: "file-delete",
                requireConfirmation: true,
                fileNames: ["Existing.tsx", "Missing.tsx"],
                session,
            },
            open.ws
        )

        expect(open.sent).toEqual([{ type: "delete-confirmed", fileNames: ["Missing.tsx"], session }])
        expect(dispatch).toHaveBeenCalledWith({
            type: "pending-deletes",
            files: [{ fileName: "Existing.tsx", content: "existing content" }],
            session,
            source: "runtime",
        })
    })

    it("acknowledges all missing delete prompt paths without opening an empty prompt", async () => {
        const dispatch = vi.fn()
        const api = {
            readCurrentContent: vi.fn(async () => undefined),
        } as unknown as import("./api").CodeFilesAPI
        const handleMessage = createMessageHandler({ dispatch, api })
        const session = { connectionId: 1, promptId: "deletes" }
        const open = socket()

        await handleMessage(
            {
                type: "file-delete",
                requireConfirmation: true,
                fileNames: ["MissingA.tsx", "MissingB.tsx"],
                session,
            },
            open.ws
        )

        expect(open.sent).toEqual([{ type: "delete-confirmed", fileNames: ["MissingA.tsx", "MissingB.tsx"], session }])
        expect(dispatch).not.toHaveBeenCalled()
    })
})
