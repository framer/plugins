import type { ConflictSummary, PendingDelete, ProjectInfo, PromptSession, SyncPhase } from "@code-link/shared"

export type UiState =
    | { kind: "loading" }
    | { kind: "info" }
    | { kind: "syncing" }
    | { kind: "idle" }
    | { kind: "deletePrompt"; session: PromptSession; deletes: PendingDelete[]; source: "initial" | "runtime" }
    | { kind: "conflictPrompt"; session: PromptSession; conflicts: ConflictSummary[] }
    | { kind: "replaced" }
    | { kind: "error"; message: string }

export interface State {
    ui: UiState
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
    ui: { kind: "loading" },
    permissionsGranted: false,
    syncPhase: null,
}

function baseUiAfterPromptClear(state: State): UiState {
    if (state.ui.kind === "replaced") return state.ui
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
                    ui: { kind: "info" },
                    syncPhase: null,
                }
            }
            return {
                ...state,
                permissionsGranted: true,
                ui: state.ui.kind === "info" ? { kind: "loading" } : state.ui,
            }
        case "socket-connected":
            return {
                ...state,
                ui: { kind: "loading" },
            }
        case "socket-disconnected":
            return {
                ...state,
                ui: { kind: "info" },
                syncPhase: null,
            }
        case "socket-replaced":
            return {
                ...state,
                ui: { kind: "replaced" },
                syncPhase: null,
            }
        case "sync-phase": {
            if (state.ui.kind === "deletePrompt" || state.ui.kind === "conflictPrompt") {
                return {
                    ...state,
                    syncPhase: action.syncPhase,
                }
            }
            if (state.ui.kind === "replaced") {
                return {
                    ...state,
                    syncPhase: action.syncPhase,
                }
            }
            if (!state.permissionsGranted) {
                return {
                    ...state,
                    syncPhase: action.syncPhase,
                    ui: { kind: "info" },
                }
            }
            const next: UiState =
                action.syncPhase === "initial_sync"
                    ? { kind: "syncing" }
                    : action.syncPhase === "ready"
                      ? { kind: "idle" }
                      : { kind: "loading" }
            return {
                ...state,
                syncPhase: action.syncPhase,
                ui: next,
            }
        }
        case "pending-deletes":
            if (
                state.ui.kind === "deletePrompt" &&
                state.ui.session.connectionId === action.session.connectionId &&
                state.ui.session.promptId === action.session.promptId
            ) {
                const byPath = new Map(state.ui.deletes.map(file => [file.fileName, file]))
                for (const file of action.files) byPath.set(file.fileName, file)
                return {
                    ...state,
                    ui: {
                        kind: "deletePrompt",
                        session: state.ui.session,
                        deletes: [...byPath.values()],
                        source: action.source,
                    },
                }
            }
            return {
                ...state,
                ui: {
                    kind: "deletePrompt",
                    session: action.session,
                    deletes: action.files,
                    source: action.source,
                },
            }
        case "clear-pending-deletes":
            if (action.session) {
                if (state.ui.kind !== "deletePrompt") return state
                if (
                    state.ui.session.connectionId !== action.session.connectionId ||
                    state.ui.session.promptId !== action.session.promptId
                ) {
                    return state
                }
            }
            if (action.fileNames && state.ui.kind === "deletePrompt") {
                const cleared = new Set(action.fileNames)
                const deletes = state.ui.deletes.filter(file => !cleared.has(file.fileName))
                return {
                    ...state,
                    ui:
                        deletes.length > 0
                            ? {
                                  kind: "deletePrompt",
                                  session: state.ui.session,
                                  deletes,
                                  source: state.ui.source,
                              }
                            : baseUiAfterPromptClear(state),
                }
            }
            return {
                ...state,
                ui: baseUiAfterPromptClear(state),
            }
        case "conflicts":
            if (action.conflicts.length === 0) {
                return {
                    ...state,
                    ui: baseUiAfterPromptClear(state),
                }
            }
            return {
                ...state,
                ui: {
                    kind: "conflictPrompt",
                    session: action.session,
                    conflicts: action.conflicts,
                },
            }
        case "clear-conflicts":
            if (action.session) {
                if (state.ui.kind !== "conflictPrompt") return state
                if (
                    state.ui.session.connectionId !== action.session.connectionId ||
                    state.ui.session.promptId !== action.session.promptId
                ) {
                    return state
                }
            }
            return {
                ...state,
                ui: baseUiAfterPromptClear(state),
            }
    }
}
