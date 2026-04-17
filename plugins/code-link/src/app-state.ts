import {
    type ConflictSummary,
    type Mode,
    type PendingDelete,
    type ProjectInfo,
    type SyncPhase,
} from "@code-link/shared"
import { modeFromSyncPhase } from "./sync-phase"

export interface State {
    /** User-visible UI mode (derived + overlays; never sent on the wire). */
    pluginMode: Mode
    project?: ProjectInfo
    permissionsGranted: boolean
    /** Last effect-stable phase reported by the CLI (`sync-phase` message). */
    syncPhase: SyncPhase | null
    pendingDeletes: PendingDelete[]
    conflicts: ConflictSummary[]
}

export type Action =
    | { type: "project-loaded"; project: ProjectInfo }
    | { type: "permissions-updated"; granted: boolean }
    | { type: "set-plugin-mode"; pluginMode: Mode }
    | { type: "socket-disconnected"; message: string }
    | { type: "socket-replaced" }
    | { type: "sync-phase"; syncPhase: SyncPhase }
    | { type: "pending-deletes"; files: PendingDelete[] }
    | { type: "clear-pending-deletes" }
    | { type: "conflicts"; conflicts: ConflictSummary[] }
    | { type: "clear-conflicts" }

export const initialState: State = {
    pluginMode: "loading",
    permissionsGranted: false,
    syncPhase: null,
    pendingDeletes: [],
    conflicts: [],
}

function clearPromptState(state: State, nextPluginMode: Mode, nextSyncPhase: SyncPhase | null): State {
    return {
        ...state,
        pluginMode: nextPluginMode,
        syncPhase: nextSyncPhase,
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
                pluginMode: state.pluginMode === "info" ? "loading" : state.pluginMode,
            }
        case "set-plugin-mode":
            return {
                ...state,
                pluginMode: action.pluginMode,
            }
        case "socket-disconnected":
            return clearPromptState(state, "info", null)
        case "socket-replaced":
            return clearPromptState(state, "replaced", null)
        case "sync-phase": {
            const nextPluginMode =
                state.pendingDeletes.length > 0
                    ? "delete_confirmation"
                    : state.conflicts.length > 0
                      ? "conflict_resolution"
                      : state.pluginMode === "replaced"
                        ? "replaced"
                        : !state.permissionsGranted
                          ? "info"
                          : modeFromSyncPhase(action.syncPhase)
            return {
                ...state,
                pluginMode: nextPluginMode,
                syncPhase: action.syncPhase,
            }
        }
        case "pending-deletes":
            return {
                ...state,
                pendingDeletes: [...state.pendingDeletes, ...action.files],
                pluginMode: "delete_confirmation",
            }
        case "clear-pending-deletes":
            return {
                ...state,
                pendingDeletes: [],
                pluginMode:
                    state.conflicts.length > 0 ? "conflict_resolution" : modeFromSyncPhase(state.syncPhase),
            }
        case "conflicts":
            return {
                ...state,
                conflicts: action.conflicts,
                pluginMode: "conflict_resolution",
            }
        case "clear-conflicts":
            return {
                ...state,
                conflicts: [],
                pluginMode:
                    state.pendingDeletes.length > 0 ? "delete_confirmation" : modeFromSyncPhase(state.syncPhase),
            }
    }
}
