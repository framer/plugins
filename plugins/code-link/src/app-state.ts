import type { ConflictSummary, PendingDelete, ProjectInfo, PromptSession, SyncPhase } from "@code-link/shared"

export type PluginViewState =
    | { kind: "loading" }
    | { kind: "info" }
    | { kind: "syncing" }
    | { kind: "idle" }
    | { kind: "deletePrompt"; session: PromptSession; deletes: PendingDelete[]; source: "initial" | "runtime" }
    | { kind: "conflictPrompt"; session: PromptSession; conflicts: ConflictSummary[] }
    | { kind: "replaced" }
    | { kind: "error"; message: string }

export interface State {
    view: PluginViewState
    project?: ProjectInfo
    permissionsGranted: boolean
    /** Last effect-stable phase reported by the CLI (`sync-phase` message). */
    syncPhase: SyncPhase | null
}

export type Action =
    | { type: "project-loaded"; project: ProjectInfo }
    | { type: "permissions-updated"; granted: boolean }
    | { type: "socket-connected" }
    | { type: "socket-disconnected"; message: string }
    | { type: "socket-replaced" }
    | { type: "sync-phase"; syncPhase: SyncPhase }
    | { type: "pending-deletes"; files: PendingDelete[]; session: PromptSession; source: "initial" | "runtime" }
    | { type: "clear-pending-deletes"; session?: PromptSession; fileNames?: string[] }
    | { type: "conflicts"; conflicts: ConflictSummary[]; session: PromptSession }
    | { type: "clear-conflicts"; session?: PromptSession }

export const initialState: State = {
    view: { kind: "loading" },
    permissionsGranted: false,
    syncPhase: null,
}

function baseViewAfterPromptClear(state: State): PluginViewState {
    if (state.view.kind === "replaced") return state.view
    if (!state.permissionsGranted) return { kind: "info" }
    if (state.syncPhase === "initial_sync") return { kind: "syncing" }
    if (state.syncPhase === "ready") return { kind: "idle" }
    return { kind: "loading" }
}

export function reducer(state: State, action: Action): State {
    switch (action.type) {
        case "project-loaded":
            return {
                ...state,
                project: action.project,
            }
        case "permissions-updated":
            if (!action.granted) {
                return {
                    ...state,
                    permissionsGranted: false,
                    view: { kind: "info" },
                    syncPhase: null,
                }
            }
            return {
                ...state,
                permissionsGranted: true,
                view: state.view.kind === "info" ? { kind: "loading" } : state.view,
            }
        case "socket-connected":
            return {
                ...state,
                view: { kind: "loading" },
            }
        case "socket-disconnected":
            return {
                ...state,
                view: { kind: "info" },
                syncPhase: null,
            }
        case "socket-replaced":
            return {
                ...state,
                view: { kind: "replaced" },
                syncPhase: null,
            }
        case "sync-phase": {
            if (state.view.kind === "deletePrompt" || state.view.kind === "conflictPrompt") {
                return {
                    ...state,
                    syncPhase: action.syncPhase,
                }
            }
            if (state.view.kind === "replaced") {
                return {
                    ...state,
                    syncPhase: action.syncPhase,
                }
            }
            if (!state.permissionsGranted) {
                return {
                    ...state,
                    syncPhase: action.syncPhase,
                    view: { kind: "info" },
                }
            }
            const next: PluginViewState = action.syncPhase === "initial_sync" ? { kind: "syncing" } : { kind: "idle" }
            return {
                ...state,
                syncPhase: action.syncPhase,
                view: next,
            }
        }
        case "pending-deletes":
            if (
                state.view.kind === "deletePrompt" &&
                state.view.session.connectionId === action.session.connectionId &&
                state.view.session.promptId === action.session.promptId
            ) {
                const byPath = new Map(state.view.deletes.map(file => [file.fileName, file]))
                for (const file of action.files) byPath.set(file.fileName, file)
                return {
                    ...state,
                    view: {
                        kind: "deletePrompt",
                        session: state.view.session,
                        deletes: [...byPath.values()],
                        source: action.source,
                    },
                }
            }
            return {
                ...state,
                view: {
                    kind: "deletePrompt",
                    session: action.session,
                    deletes: action.files,
                    source: action.source,
                },
            }
        case "clear-pending-deletes":
            if (state.view.kind !== "deletePrompt") return state
            if (action.session) {
                if (
                    state.view.session.connectionId !== action.session.connectionId ||
                    state.view.session.promptId !== action.session.promptId
                ) {
                    return state
                }
            }
            if (action.fileNames) {
                const cleared = new Set(action.fileNames)
                const deletes = state.view.deletes.filter(file => !cleared.has(file.fileName))
                return {
                    ...state,
                    view:
                        deletes.length > 0
                            ? {
                                  kind: "deletePrompt",
                                  session: state.view.session,
                                  deletes,
                                  source: state.view.source,
                              }
                            : baseViewAfterPromptClear(state),
                }
            }
            return {
                ...state,
                view: baseViewAfterPromptClear(state),
            }
        case "conflicts":
            if (action.conflicts.length === 0) {
                return {
                    ...state,
                    view: baseViewAfterPromptClear(state),
                }
            }
            return {
                ...state,
                view: {
                    kind: "conflictPrompt",
                    session: action.session,
                    conflicts: action.conflicts,
                },
            }
        case "clear-conflicts":
            if (state.view.kind !== "conflictPrompt") return state
            if (action.session) {
                if (
                    state.view.session.connectionId !== action.session.connectionId ||
                    state.view.session.promptId !== action.session.promptId
                ) {
                    return state
                }
            }
            return {
                ...state,
                view: baseViewAfterPromptClear(state),
            }
    }
}
