import { describe, expect, it } from "vitest"
import { initialState, reducer, type State } from "./app-state"

function withPromptState(overrides: Partial<State> = {}): State {
    return {
        ...initialState,
        permissionsGranted: true,
        syncMode: "conflict_resolution",
        mode: "delete_confirmation",
        pendingDeletes: [{ fileName: "Button.tsx", content: "export const Button = 1" }],
        conflicts: [
            {
                fileName: "Card.tsx",
                localContent: "local",
                remoteContent: "remote",
            },
        ],
        ...overrides,
    }
}

describe("plugin app state", () => {
    it("clears stale prompts on disconnect before the next sync-mode arrives", () => {
        const disconnected = reducer(withPromptState(), {
            type: "socket-disconnected",
            message: "socket closed",
        })

        expect(disconnected.mode).toBe("info")
        expect(disconnected.syncMode).toBeNull()
        expect(disconnected.pendingDeletes).toEqual([])
        expect(disconnected.conflicts).toEqual([])

        const reconnected = reducer(disconnected, {
            type: "sync-mode",
            syncMode: "snapshot_processing",
        })

        expect(reconnected.mode).toBe("syncing")
        expect(reconnected.pendingDeletes).toEqual([])
        expect(reconnected.conflicts).toEqual([])
    })

    it("clears stale prompts when permissions are lost", () => {
        const next = reducer(withPromptState(), {
            type: "permissions-updated",
            granted: false,
        })

        expect(next.mode).toBe("info")
        expect(next.syncMode).toBeNull()
        expect(next.pendingDeletes).toEqual([])
        expect(next.conflicts).toEqual([])
    })

    it("clears stale prompts when the plugin is replaced", () => {
        const next = reducer(withPromptState(), {
            type: "socket-replaced",
        })

        expect(next.mode).toBe("replaced")
        expect(next.syncMode).toBeNull()
        expect(next.pendingDeletes).toEqual([])
        expect(next.conflicts).toEqual([])
    })
})
