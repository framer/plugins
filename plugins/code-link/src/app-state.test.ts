import { describe, expect, it } from "vitest"
import { initialState, reducer, type State } from "./app-state"

const testSession = { connectionId: 1, promptId: "test-prompt" }

function withPromptState(overrides: Partial<State> = {}): State {
    return {
        ...initialState,
        permissionsGranted: true,
        syncStatus: "initial_sync",
        pluginView: {
            kind: "deletePrompt",
            session: testSession,
            deletes: [{ fileName: "Button.tsx", content: "export const Button = 1" }],
            source: "runtime",
        },
        ...overrides,
    }
}

describe("plugin app state", () => {
    it("clears stale prompts on disconnect before the next sync-status arrives", () => {
        const disconnected = reducer(withPromptState(), {
            type: "socket-disconnected",
            message: "socket closed",
        })

        expect(disconnected.pluginView.kind).toBe("info")
        expect(disconnected.syncStatus).toBeNull()

        const reconnected = reducer(disconnected, {
            type: "sync-status",
            syncStatus: "initial_sync",
        })

        expect(reconnected.pluginView.kind).toBe("syncing")
    })

    it("clears stale prompts when permissions are lost", () => {
        const next = reducer(withPromptState(), {
            type: "permissions-updated",
            granted: false,
        })

        expect(next.pluginView.kind).toBe("info")
        expect(next.syncStatus).toBeNull()
    })

    it("clears stale prompts when the plugin is replaced", () => {
        const next = reducer(withPromptState(), {
            type: "socket-replaced",
        })

        expect(next.pluginView.kind).toBe("replaced")
        expect(next.syncStatus).toBeNull()
    })

    it("updates the active conflict prompt instead of queueing stale conflict modals", () => {
        const conflicting = reducer(
            { ...initialState, permissionsGranted: true, syncStatus: "ready", pluginView: { kind: "idle" } },
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

        expect(updated.pluginView).toEqual({
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
            { ...initialState, permissionsGranted: true, syncStatus: "ready", pluginView: { kind: "idle" } },
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

        expect(staleClear.pluginView.kind).toBe("conflictPrompt")
    })

    it("does not let conflict clear messages close an active delete prompt", () => {
        const state = withPromptState({ syncStatus: "ready" })

        const next = reducer(state, {
            type: "clear-conflicts",
            session: testSession,
        })

        expect(next.pluginView).toEqual(state.pluginView)
    })

    it("does not let unscoped conflict clears close an active delete prompt", () => {
        const state = withPromptState({ syncStatus: "ready" })

        const next = reducer(state, {
            type: "clear-conflicts",
        })

        expect(next.pluginView).toEqual(state.pluginView)
    })

    it("removes invalidated delete files without closing the remaining delete prompt", () => {
        const state = withPromptState({
            syncStatus: "ready",
            pluginView: {
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

        expect(next.pluginView).toEqual({
            kind: "deletePrompt",
            session: testSession,
            deletes: [{ fileName: "B.tsx", content: "b" }],
            source: "runtime",
        })
    })

    it("ignores delete clear messages for stale sessions", () => {
        const state = withPromptState({ syncStatus: "ready" })

        const next = reducer(state, {
            type: "clear-pending-deletes",
            session: { connectionId: 2, promptId: "stale" },
            fileNames: ["Button.tsx"],
        })

        expect(next.pluginView).toEqual(state.pluginView)
    })

    it("does not let unscoped delete clears close an active conflict prompt", () => {
        const state = reducer(
            { ...initialState, permissionsGranted: true, syncStatus: "ready", pluginView: { kind: "idle" } },
            {
                type: "conflicts",
                session: testSession,
                conflicts: [{ fileName: "A.tsx", localContent: "local", remoteContent: "remote" }],
            }
        )

        const next = reducer(state, {
            type: "clear-pending-deletes",
        })

        expect(next.pluginView).toEqual(state.pluginView)
    })
})
