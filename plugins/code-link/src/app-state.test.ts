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

    it("updates the active conflict prompt instead of queueing stale conflict modals", () => {
        const conflicting = reducer(
            { ...initialState, permissionsGranted: true, syncPhase: "ready", ui: { kind: "idle" } },
            {
                type: "conflicts",
                session: testSession,
                conflicts: [{ fileName: "A.tsx", localContent: "local 1", remoteContent: "remote" }],
            }
        )

        const updated = reducer(conflicting, {
            type: "conflicts",
            session: testSession,
            conflicts: [
                { fileName: "A.tsx", localContent: "local 2", remoteContent: "remote" },
                { fileName: "B.tsx", localContent: "local", remoteContent: "remote" },
            ],
        })

        expect(updated.ui).toEqual({
            kind: "conflictPrompt",
            session: testSession,
            conflicts: [
                { fileName: "A.tsx", localContent: "local 2", remoteContent: "remote" },
                { fileName: "B.tsx", localContent: "local", remoteContent: "remote" },
            ],
        })
    })

    it("ignores conflict clear messages for stale sessions", () => {
        const state = reducer(
            { ...initialState, permissionsGranted: true, syncPhase: "ready", ui: { kind: "idle" } },
            {
                type: "conflicts",
                session: testSession,
                conflicts: [{ fileName: "A.tsx", localContent: "local", remoteContent: "remote" }],
            }
        )

        const staleClear = reducer(state, {
            type: "clear-conflicts",
            session: { connectionId: 2, promptId: "stale" },
        })

        expect(staleClear.ui.kind).toBe("conflictPrompt")
    })

    it("does not let conflict clear messages close an active delete prompt", () => {
        const state = withPromptState({ syncPhase: "ready" })

        const next = reducer(state, {
            type: "clear-conflicts",
            session: testSession,
        })

        expect(next.ui).toEqual(state.ui)
    })

    it("removes invalidated delete files without closing the remaining delete prompt", () => {
        const state = withPromptState({
            syncPhase: "ready",
            ui: {
                kind: "deletePrompt",
                session: testSession,
                deletes: [
                    { fileName: "A.tsx", content: "a" },
                    { fileName: "B.tsx", content: "b" },
                ],
                source: "runtime",
            },
        })

        const next = reducer(state, {
            type: "clear-pending-deletes",
            session: testSession,
            fileNames: ["A.tsx"],
        })

        expect(next.ui).toEqual({
            kind: "deletePrompt",
            session: testSession,
            deletes: [{ fileName: "B.tsx", content: "b" }],
            source: "runtime",
        })
    })

    it("ignores delete clear messages for stale sessions", () => {
        const state = withPromptState({ syncPhase: "ready" })

        const next = reducer(state, {
            type: "clear-pending-deletes",
            session: { connectionId: 2, promptId: "stale" },
            fileNames: ["Button.tsx"],
        })

        expect(next.ui).toEqual(state.ui)
    })
})
