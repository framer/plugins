import { describe, expect, it } from "vitest"
import { initialState, reducer, type State } from "./app-state"

const testSession = { connectionId: 1, promptId: "test-prompt" }

function withPromptState(overrides: Partial<State> = {}): State {
    return {
        ...initialState,
        permissionsGranted: true,
        syncPhase: "initial_sync",
        ui: {
            kind: "deletePrompt",
            session: testSession,
            deletes: [{ fileName: "Button.tsx", content: "export const Button = 1" }],
            source: "runtime",
        },
        ...overrides,
    }
}

describe("plugin app state", () => {
    it("clears stale prompts on disconnect before the next sync-phase arrives", () => {
        const disconnected = reducer(withPromptState(), {
            type: "socket-disconnected",
            message: "socket closed",
        })

        expect(disconnected.ui.kind).toBe("info")
        expect(disconnected.syncPhase).toBeNull()

        const reconnected = reducer(disconnected, {
            type: "sync-phase",
            syncPhase: "initial_sync",
        })

        expect(reconnected.ui.kind).toBe("syncing")
    })

    it("clears stale prompts when permissions are lost", () => {
        const next = reducer(withPromptState(), {
            type: "permissions-updated",
            granted: false,
        })

        expect(next.ui.kind).toBe("info")
        expect(next.syncPhase).toBeNull()
    })

    it("clears stale prompts when the plugin is replaced", () => {
        const next = reducer(withPromptState(), {
            type: "socket-replaced",
        })

        expect(next.ui.kind).toBe("replaced")
        expect(next.syncPhase).toBeNull()
    })
})
