import { describe, expect, it } from "vitest"
import { initialState, reducer, type State } from "./app-state"

function withPromptState(overrides: Partial<State> = {}): State {
    return {
        ...initialState,
        permissionsGranted: true,
        syncPhase: "initial_sync",
        pluginMode: "delete_confirmation",
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
    it("clears stale prompts on disconnect before the next sync-phase arrives", () => {
        const disconnected = reducer(withPromptState(), {
            type: "socket-disconnected",
            message: "socket closed",
        })

        expect(disconnected.pluginMode).toBe("info")
        expect(disconnected.syncPhase).toBeNull()
        expect(disconnected.pendingDeletes).toEqual([])
        expect(disconnected.conflicts).toEqual([])

        const reconnected = reducer(disconnected, {
            type: "sync-phase",
            syncPhase: "initial_sync",
        })

        expect(reconnected.pluginMode).toBe("syncing")
        expect(reconnected.pendingDeletes).toEqual([])
        expect(reconnected.conflicts).toEqual([])
    })

    it("clears stale prompts when permissions are lost", () => {
        const next = reducer(withPromptState(), {
            type: "permissions-updated",
            granted: false,
        })

        expect(next.pluginMode).toBe("info")
        expect(next.syncPhase).toBeNull()
        expect(next.pendingDeletes).toEqual([])
        expect(next.conflicts).toEqual([])
    })

    it("clears stale prompts when the plugin is replaced", () => {
        const next = reducer(withPromptState(), {
            type: "socket-replaced",
        })

        expect(next.pluginMode).toBe("replaced")
        expect(next.syncPhase).toBeNull()
        expect(next.pendingDeletes).toEqual([])
        expect(next.conflicts).toEqual([])
    })
})
