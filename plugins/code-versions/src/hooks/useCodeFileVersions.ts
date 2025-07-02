import { type CodeFile, type CodeFileVersion, useIsAllowedTo } from "framer-plugin"
import { useCallback, useEffect, useReducer } from "react"
import { match } from "ts-pattern"
import { StatusTypes, useSelectedCodeFile } from "./useSelectedCodeFile"

export enum LoadingState {
    Idle,
    Initial,
    Refreshing,
}

// Use event-based naming for actions
// Do: VERSIONS_LOADED, VERSION_SELECTED, LOADING_STARTED
// Don't: SET_VERSIONS, SELECT_VERSION, SET_LOADING
export enum VersionsActionType {
    CodeFileSelected = "CODE_FILE_SELECTED",
    VersionsLoadStarted = "VERSIONS_LOAD_STARTED",
    VersionsLoaded = "VERSIONS_LOADED",
    VersionSelected = "VERSION_SELECTED",
    ContentLoadStarted = "CONTENT_LOAD_STARTED",
    VersionContentLoaded = "VERSION_CONTENT_LOADED",
    VersionsError = "VERSIONS_ERROR",
    ContentError = "CONTENT_ERROR",
    RestoreError = "RESTORE_ERROR",
    ErrorsCleared = "ERRORS_CLEARED",
    StateResetCompleted = "STATE_RESET_COMPLETED",
}

interface VersionsState {
    codeFile: CodeFile | undefined
    versions: readonly CodeFileVersion[]
    selectedVersionId: string | undefined
    versionContent: string | undefined
    versionsLoading: LoadingState
    contentLoading: LoadingState
    errors: {
        versions?: string
        content?: string
        restore?: string
    }
}

type VersionsAction =
    | { type: VersionsActionType.CodeFileSelected; payload: { codeFile: CodeFile } }
    | { type: VersionsActionType.VersionsLoadStarted }
    | { type: VersionsActionType.VersionsLoaded; payload: { versions: readonly CodeFileVersion[] } }
    | { type: VersionsActionType.VersionSelected; payload: { versionId: string } }
    | { type: VersionsActionType.ContentLoadStarted }
    | { type: VersionsActionType.VersionContentLoaded; payload: { content: string | undefined } }
    | { type: VersionsActionType.VersionsError; payload: { error: string } }
    | { type: VersionsActionType.ContentError; payload: { error: string } }
    | { type: VersionsActionType.RestoreError; payload: { error: string } }
    | { type: VersionsActionType.ErrorsCleared }
    | { type: VersionsActionType.StateResetCompleted }

const initialState: VersionsState = {
    codeFile: undefined,
    versions: [],
    selectedVersionId: undefined,
    versionContent: undefined,
    versionsLoading: LoadingState.Idle,
    contentLoading: LoadingState.Idle,
    errors: {},
}

function versionsReducer(state: VersionsState, action: VersionsAction): VersionsState {
    return match(action)
        .with({ type: VersionsActionType.CodeFileSelected }, ({ payload }) => {
            if (state.codeFile?.id !== payload.codeFile.id) {
                // A different code file is being selected
                return {
                    ...state,
                    codeFile: payload.codeFile,
                    versions: [],
                    selectedVersionId: undefined,
                    versionContent: undefined,
                    versionsLoading: LoadingState.Initial,
                    contentLoading: LoadingState.Initial,
                    errors: {},
                }
            } else {
                // Only update the codeFile reference
                return {
                    ...state,
                    codeFile: payload.codeFile,
                }
            }
        })
        .with({ type: VersionsActionType.VersionsLoadStarted }, () => ({
            ...state,
            versionsLoading: state.versions.length === 0 ? LoadingState.Initial : LoadingState.Refreshing,
            errors: { ...state.errors, versions: undefined },
        }))
        .with({ type: VersionsActionType.VersionsLoaded }, ({ payload }) => ({
            ...state,
            versions: payload.versions,
            versionsLoading: LoadingState.Idle,
            selectedVersionId:
                payload.versions.length > 0 && !state.selectedVersionId
                    ? payload.versions[0]?.id
                    : state.selectedVersionId,
            errors: { ...state.errors, versions: undefined },
        }))
        .with({ type: VersionsActionType.VersionSelected }, ({ payload }) => ({
            ...state,
            selectedVersionId: payload.versionId,
            versionContent: undefined,
            errors: { ...state.errors, content: undefined },
        }))
        .with({ type: VersionsActionType.ContentLoadStarted }, () => ({
            ...state,
            contentLoading: state.versionContent == null ? LoadingState.Initial : LoadingState.Refreshing,
            errors: { ...state.errors, content: undefined },
        }))
        .with({ type: VersionsActionType.VersionContentLoaded }, ({ payload }) => ({
            ...state,
            versionContent: payload.content,
            contentLoading: LoadingState.Idle,
            errors: { ...state.errors, content: undefined },
        }))
        .with({ type: VersionsActionType.VersionsError }, ({ payload }) => ({
            ...state,
            versionsLoading: LoadingState.Idle,
            errors: { ...state.errors, versions: payload.error },
        }))
        .with({ type: VersionsActionType.ContentError }, ({ payload }) => ({
            ...state,
            contentLoading: LoadingState.Idle,
            errors: { ...state.errors, content: payload.error },
        }))
        .with({ type: VersionsActionType.RestoreError }, ({ payload }) => ({
            ...state,
            errors: { ...state.errors, restore: payload.error },
        }))
        .with({ type: VersionsActionType.ErrorsCleared }, () => ({
            ...state,
            errors: {},
        }))
        .with({ type: VersionsActionType.StateResetCompleted }, () => initialState)
        .exhaustive()
}

export interface CodeFileVersionsState {
    // Current state
    state: VersionsState

    // Actions
    selectVersion: (id: string) => void
    restoreVersion: () => Promise<void>
    clearErrors: () => void
}

export function useCodeFileVersions(): CodeFileVersionsState {
    const { state: fileStatus } = useSelectedCodeFile()
    const [state, dispatch] = useReducer(versionsReducer, initialState)

    // Derived state
    const selectedVersion = state.versions.find(version => version.id === state.selectedVersionId)

    // Helper to load versions
    const loadVersions = useCallback(async (codeFile: CodeFile) => {
        dispatch({ type: VersionsActionType.VersionsLoadStarted })
        try {
            const versions = await codeFile.getVersions()
            dispatch({ type: VersionsActionType.VersionsLoaded, payload: { versions } })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to load versions"
            dispatch({ type: VersionsActionType.VersionsError, payload: { error: errorMessage } })
        }
    }, [])

    // Handle file selection changes
    useEffect(() => {
        if (fileStatus.type !== StatusTypes.SELECTED_CODE_FILE) {
            dispatch({ type: VersionsActionType.StateResetCompleted })
            return
        }

        dispatch({ type: VersionsActionType.CodeFileSelected, payload: { codeFile: fileStatus.codeFile } })
    }, [fileStatus])

    // Load versions when codeFile changes
    useEffect(() => {
        if (!state.codeFile) return

        loadVersions(state.codeFile)
    }, [state.codeFile, loadVersions])

    // Load version content when selected version changes
    useEffect(() => {
        if (!selectedVersion) {
            dispatch({ type: VersionsActionType.VersionContentLoaded, payload: { content: undefined } })
            return
        }
        dispatch({ type: VersionsActionType.ContentLoadStarted })
        selectedVersion
            .getContent()
            .then(content => {
                dispatch({ type: VersionsActionType.VersionContentLoaded, payload: { content } })
            })
            .catch(error => {
                const errorMessage = error instanceof Error ? error.message : "Failed to load version content"
                dispatch({ type: VersionsActionType.ContentError, payload: { error: errorMessage } })
            })
    }, [selectedVersion])

    // Actions
    const selectVersion = useCallback((id: string) => {
        dispatch({ type: VersionsActionType.VersionSelected, payload: { versionId: id } })
    }, [])

    const restoreVersion = useCallback(async () => {
        if (!state.versionContent || !state.codeFile) return

        try {
            const newCodeFile = await state.codeFile.setFileContent(state.versionContent)
            dispatch({ type: VersionsActionType.CodeFileSelected, payload: { codeFile: newCodeFile } })
            await loadVersions(newCodeFile)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to restore version"
            dispatch({ type: VersionsActionType.RestoreError, payload: { error: errorMessage } })
        }
    }, [state.versionContent, state.codeFile, loadVersions])

    const clearErrors = useCallback(() => {
        dispatch({ type: VersionsActionType.ErrorsCleared })
    }, [])

    return {
        // Current state
        state: {
            codeFile: state.codeFile,
            versions: state.versions,
            selectedVersionId: state.selectedVersionId,
            versionContent: state.versionContent,
            versionsLoading: state.versionsLoading,
            contentLoading: state.contentLoading,
            errors: state.errors,
        },

        // Actions
        selectVersion,
        restoreVersion,
        clearErrors,
    }
}

export const useCanRestoreVersion = () => {
    return useIsAllowedTo("CodeFile.setFileContent")
}
