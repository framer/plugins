import type { ConflictSummary, PendingDelete, ProjectInfo, PromptSession, SyncStatus } from "@code-link/shared"

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
    pluginView: PluginViewState
    project?: ProjectInfo
    permissionsGranted: boolean
    /** Last effect-stable status reported by the CLI (`sync-status` message). */
    syncStatus: SyncStatus | null
}

export type Action =
    | { type: "project-loaded"; project: ProjectInfo }
    | { type: "permissions-updated"; granted: boolean }
    | { type: "socket-connected" }
    | { type: "socket-disconnected"; message: string }
    | { type: "socket-replaced" }
    | { type: "sync-status"; syncStatus: SyncStatus }
    | { type: "pending-deletes"; files: PendingDelete[]; session: PromptSession; source: "initial" | "runtime" }
    | { type: "clear-pending-deletes"; session?: PromptSession; fileNames?: string[] }
    | { type: "conflicts"; conflicts: ConflictSummary[]; session: PromptSession }
    | { type: "clear-conflicts"; session?: PromptSession }

export const initialState: State = {
    pluginView: { kind: "loading" },
    permissionsGranted: false,
    syncStatus: null,
}

function baseViewAfterPromptClear(state: State): PluginViewState {
    if (state.pluginView.kind === "replaced") return state.pluginView
    if (!state.permissionsGranted) return { kind: "info" }
    if (state.syncStatus === "initial_sync") return { kind: "syncing" }
    if (state.syncStatus === "ready") return { kind: "idle" }
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
                    pluginView: { kind: "info" },
                    syncStatus: null,
                }
            }
            return {
                ...state,
                permissionsGranted: true,
                pluginView: state.pluginView.kind === "info" ? { kind: "loading" } : state.pluginView,
            }
        case "socket-connected":
            return {
                ...state,
                pluginView: { kind: "loading" },
            }
        case "socket-disconnected":
            return {
                ...state,
                pluginView: { kind: "info" },
                syncStatus: null,
            }
        case "socket-replaced":
            return {
                ...state,
                pluginView: { kind: "replaced" },
                syncStatus: null,
            }
        case "sync-status": {
            if (state.pluginView.kind === "deletePrompt" || state.pluginView.kind === "conflictPrompt") {
                return {
                    ...state,
                    syncStatus: action.syncStatus,
                }
            }
            if (state.pluginView.kind === "replaced") {
                return {
                    ...state,
                    syncStatus: action.syncStatus,
                }
            }
            if (!state.permissionsGranted) {
                return {
                    ...state,
                    syncStatus: action.syncStatus,
                    pluginView: { kind: "info" },
                }
            }
            const next: PluginViewState = action.syncStatus === "initial_sync" ? { kind: "syncing" } : { kind: "idle" }
            return {
                ...state,
                syncStatus: action.syncStatus,
                pluginView: next,
            }
        }
        case "pending-deletes":
            if (
                state.pluginView.kind === "deletePrompt" &&
                state.pluginView.session.connectionId === action.session.connectionId &&
                state.pluginView.session.promptId === action.session.promptId
            ) {
                const byPath = new Map(state.pluginView.deletes.map(file => [file.fileName, file]))
                for (const file of action.files) byPath.set(file.fileName, file)
                return {
                    ...state,
                    pluginView: {
                        kind: "deletePrompt",
                        session: state.pluginView.session,
                        deletes: [...byPath.values()],
                        source: action.source,
                    },
                }
            }
            return {
                ...state,
                pluginView: {
                    kind: "deletePrompt",
                    session: action.session,
                    deletes: action.files,
                    source: action.source,
                },
            }
        case "clear-pending-deletes":
            if (state.pluginView.kind !== "deletePrompt") return state
            if (action.session) {
                if (
                    state.pluginView.session.connectionId !== action.session.connectionId ||
                    state.pluginView.session.promptId !== action.session.promptId
                ) {
                    return state
                }
            }
            if (action.fileNames) {
                const cleared = new Set(action.fileNames)
                const deletes = state.pluginView.deletes.filter(file => !cleared.has(file.fileName))
                return {
                    ...state,
                    pluginView:
                        deletes.length > 0
                            ? {
                                  kind: "deletePrompt",
                                  session: state.pluginView.session,
                                  deletes,
                                  source: state.pluginView.source,
                              }
                            : baseViewAfterPromptClear(state),
                }
            }
            return {
                ...state,
                pluginView: baseViewAfterPromptClear(state),
            }
        case "conflicts":
            if (action.conflicts.length === 0) {
                return {
                    ...state,
                    pluginView: baseViewAfterPromptClear(state),
                }
            }
            return {
                ...state,
                pluginView: {
                    kind: "conflictPrompt",
                    session: action.session,
                    conflicts: action.conflicts,
                },
            }
        case "clear-conflicts":
            if (state.pluginView.kind !== "conflictPrompt") return state
            if (action.session) {
                if (
                    state.pluginView.session.connectionId !== action.session.connectionId ||
                    state.pluginView.session.promptId !== action.session.promptId
                ) {
                    return state
                }
            }
            return {
                ...state,
                pluginView: baseViewAfterPromptClear(state),
            }
    }
}
