import type { CodeFile, CodeFileVersion } from "framer-plugin"
import { useCallback, useEffect, useReducer } from "react"
import { match } from "ts-pattern"
import { StatusTypes, useSelectedCodeFile } from "./useSelectedCodeFile"

export enum LoadingState {
    Idle,
    Initial,
    Refreshing,
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

// Use event-based naming for actions
// Do: VERSIONS_LOADED, VERSION_SELECTED, LOADING_STARTED
// Don't: SET_VERSIONS, SELECT_VERSION, SET_LOADING
type VersionsAction =
    | { type: "CODE_FILE_SELECTED"; payload: { codeFile: CodeFile } }
    | { type: "VERSIONS_LOADING" }
    | { type: "VERSIONS_LOADED"; payload: { versions: readonly CodeFileVersion[] } }
    | { type: "VERSION_SELECTED"; payload: { versionId: string } }
    | { type: "CONTENT_LOADING" }
    | { type: "VERSION_CONTENT_LOADED"; payload: { content: string | undefined } }
    | { type: "VERSIONS_ERROR"; payload: { error: string } }
    | { type: "CONTENT_ERROR"; payload: { error: string } }
    | { type: "RESTORE_ERROR"; payload: { error: string } }
    | { type: "CLEAR_ERRORS" }
    | { type: "STATE_RESET" }

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
        .with({ type: "CODE_FILE_SELECTED" }, ({ payload }) => {
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
        .with({ type: "VERSIONS_LOADING" }, () => ({
            ...state,
            versionsLoading: state.versions.length === 0 ? LoadingState.Initial : LoadingState.Refreshing,
            errors: { ...state.errors, versions: undefined },
        }))
        .with({ type: "VERSIONS_LOADED" }, ({ payload }) => ({
            ...state,
            versions: payload.versions,
            versionsLoading: LoadingState.Idle,
            selectedVersionId:
                payload.versions.length > 0 && !state.selectedVersionId
                    ? payload.versions[0]?.id
                    : state.selectedVersionId,
            errors: { ...state.errors, versions: undefined },
        }))
        .with({ type: "VERSION_SELECTED" }, ({ payload }) => ({
            ...state,
            selectedVersionId: payload.versionId,
            versionContent: undefined,
            errors: { ...state.errors, content: undefined },
        }))
        .with({ type: "CONTENT_LOADING" }, () => ({
            ...state,
            contentLoading: state.versionContent == null ? LoadingState.Initial : LoadingState.Refreshing,
            errors: { ...state.errors, content: undefined },
        }))
        .with({ type: "VERSION_CONTENT_LOADED" }, ({ payload }) => ({
            ...state,
            versionContent: payload.content,
            contentLoading: LoadingState.Idle,
            errors: { ...state.errors, content: undefined },
        }))
        .with({ type: "VERSIONS_ERROR" }, ({ payload }) => ({
            ...state,
            versionsLoading: LoadingState.Idle,
            errors: { ...state.errors, versions: payload.error },
        }))
        .with({ type: "CONTENT_ERROR" }, ({ payload }) => ({
            ...state,
            contentLoading: LoadingState.Idle,
            errors: { ...state.errors, content: payload.error },
        }))
        .with({ type: "RESTORE_ERROR" }, ({ payload }) => ({
            ...state,
            errors: { ...state.errors, restore: payload.error },
        }))
        .with({ type: "CLEAR_ERRORS" }, () => ({
            ...state,
            errors: {},
        }))
        .with({ type: "STATE_RESET" }, () => initialState)
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
        dispatch({ type: "VERSIONS_LOADING" })
        try {
            const versions = await codeFile.getVersions()
            dispatch({ type: "VERSIONS_LOADED", payload: { versions } })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to load versions"
            dispatch({ type: "VERSIONS_ERROR", payload: { error: errorMessage } })
        }
    }, [])

    // Handle file selection changes
    useEffect(() => {
        if (fileStatus.type !== StatusTypes.SELECTED_CODE_FILE) {
            dispatch({ type: "STATE_RESET" })
            return
        }

        dispatch({ type: "CODE_FILE_SELECTED", payload: { codeFile: fileStatus.codeFile } })
    }, [fileStatus])

    // Load versions when codeFile changes
    useEffect(() => {
        if (!state.codeFile) return

        loadVersions(state.codeFile)
    }, [state.codeFile, loadVersions])

    // Load version content when selected version changes
    useEffect(() => {
        if (!selectedVersion) {
            dispatch({ type: "VERSION_CONTENT_LOADED", payload: { content: undefined } })
            return
        }
        dispatch({ type: "CONTENT_LOADING" })
        selectedVersion
            .getContent()
            .then(content => {
                dispatch({ type: "VERSION_CONTENT_LOADED", payload: { content } })
            })
            .catch(error => {
                const errorMessage = error instanceof Error ? error.message : "Failed to load version content"
                dispatch({ type: "CONTENT_ERROR", payload: { error: errorMessage } })
            })
    }, [selectedVersion])

    // Actions
    const selectVersion = useCallback((id: string) => {
        dispatch({ type: "VERSION_SELECTED", payload: { versionId: id } })
    }, [])

    const restoreVersion = useCallback(async () => {
        if (!state.versionContent || !state.codeFile) return

        try {
            const newCodeFile = await state.codeFile.setFileContent(state.versionContent)
            dispatch({ type: "CODE_FILE_SELECTED", payload: { codeFile: newCodeFile } })
            await loadVersions(newCodeFile)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to restore version"
            dispatch({ type: "RESTORE_ERROR", payload: { error: errorMessage } })
        }
    }, [state.versionContent, state.codeFile, loadVersions])

    const clearErrors = useCallback(() => {
        dispatch({ type: "CLEAR_ERRORS" })
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
