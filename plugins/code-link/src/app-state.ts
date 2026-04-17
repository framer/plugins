import {
    type CliSyncMode,
    type ConflictSummary,
    type Mode,
    type PendingDelete,
    type ProjectInfo,
} from "@code-link/shared"
import { modeFromSyncMode } from "./sync-mode"

export interface State {
    mode: Mode
    project?: ProjectInfo
    permissionsGranted: boolean
    syncMode: CliSyncMode | null
    pendingDeletes: PendingDelete[]
    conflicts: ConflictSummary[]
}

export type Action =
    | { type: "project-loaded"; project: ProjectInfo }
    | { type: "permissions-updated"; granted: boolean }
    | { type: "set-mode"; mode: Mode }
    | { type: "socket-disconnected"; message: string }
    | { type: "socket-replaced" }
    | { type: "sync-mode"; syncMode: CliSyncMode }
    | { type: "pending-deletes"; files: PendingDelete[] }
    | { type: "clear-pending-deletes" }
    | { type: "conflicts"; conflicts: ConflictSummary[] }
    | { type: "clear-conflicts" }

export const initialState: State = {
    mode: "loading",
    permissionsGranted: false,
    syncMode: null,
    pendingDeletes: [],
    conflicts: [],
}

function clearPromptState(state: State, nextMode: Mode, nextSyncMode: CliSyncMode | null): State {
    return {
        ...state,
        mode: nextMode,
        syncMode: nextSyncMode,
        pendingDeletes: [],
        conflicts: [],
    }
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
                    ...clearPromptState(state, "info", null),
                    permissionsGranted: false,
                }
            }
            return {
                ...state,
                permissionsGranted: true,
                mode: state.mode === "info" ? "loading" : state.mode,
            }
        case "set-mode":
            return {
                ...state,
                mode: action.mode,
            }
        case "socket-disconnected":
            return clearPromptState(state, "info", null)
        case "socket-replaced":
            return clearPromptState(state, "replaced", null)
        case "sync-mode": {
            const nextMode =
                state.pendingDeletes.length > 0
                    ? "delete_confirmation"
                    : state.conflicts.length > 0
                      ? "conflict_resolution"
                      : state.mode === "replaced"
                        ? "replaced"
                        : !state.permissionsGranted
                          ? "info"
                          : modeFromSyncMode(action.syncMode)
            return {
                ...state,
                mode: nextMode,
                syncMode: action.syncMode,
            }
        }
        case "pending-deletes":
            return {
                ...state,
                pendingDeletes: [...state.pendingDeletes, ...action.files],
                mode: "delete_confirmation",
            }
        case "clear-pending-deletes":
            return {
                ...state,
                pendingDeletes: [],
                mode: state.conflicts.length > 0 ? "conflict_resolution" : modeFromSyncMode(state.syncMode),
            }
        case "conflicts":
            return {
                ...state,
                conflicts: action.conflicts,
                mode: "conflict_resolution",
            }
        case "clear-conflicts":
            return {
                ...state,
                conflicts: [],
                mode: state.pendingDeletes.length > 0 ? "delete_confirmation" : modeFromSyncMode(state.syncMode),
            }
    }
}
