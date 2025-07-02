import type { CodeFile, CodeFileVersion } from "framer-plugin"
import { useCallback, useEffect, useReducer } from "react"
import { match } from "ts-pattern"
import { StatusTypes, useSelectedCodeFile } from "./useSelectedCodeFile"

interface VersionsState {
    codeFile: CodeFile | undefined
    versions: readonly CodeFileVersion[]
    selectedVersionId: string | undefined
    versionContent: string | undefined
    isLoadingVersions: boolean
    isLoadingContent: boolean
}

// Use event-based naming for actions
// Do: VERSIONS_LOADED, VERSION_SELECTED, LOADING_STARTED
// Don't: SET_VERSIONS, SELECT_VERSION, SET_LOADING
type VersionsAction =
    | { type: "CODE_FILE_SELECTED"; payload: { codeFile: CodeFile } }
    | { type: "VERSIONS_LOADED"; payload: { versions: readonly CodeFileVersion[] } }
    | { type: "VERSION_SELECTED"; payload: { versionId: string } }
    | { type: "VERSION_CONTENT_LOADED"; payload: { content: string | undefined } }
    | { type: "LOADING_VERSIONS_STARTED" }
    | { type: "LOADING_VERSIONS_FINISHED" }
    | { type: "LOADING_CONTENT_STARTED" }
    | { type: "LOADING_CONTENT_FINISHED" }
    | { type: "STATE_RESET" }

const initialState: VersionsState = {
    codeFile: undefined,
    versions: [],
    selectedVersionId: undefined,
    versionContent: undefined,
    isLoadingVersions: false,
    isLoadingContent: false,
}

function versionsReducer(state: VersionsState, action: VersionsAction): VersionsState {
    return match(action)
        .with({ type: "CODE_FILE_SELECTED" }, ({ payload }) => ({
            ...state,
            codeFile: payload.codeFile,
            // Reset version state when file changes
            versions: [],
            selectedVersionId: undefined,
            versionContent: undefined,
        }))
        .with({ type: "VERSIONS_LOADED" }, ({ payload }) => ({
            ...state,
            versions: payload.versions,
            // Auto-select first version if available and no version is currently selected
            selectedVersionId:
                payload.versions.length > 0 && !state.selectedVersionId
                    ? payload.versions[0]?.id
                    : state.selectedVersionId,
        }))
        .with({ type: "VERSION_SELECTED" }, ({ payload }) => ({
            ...state,
            selectedVersionId: payload.versionId,
            versionContent: undefined,
        }))
        .with({ type: "VERSION_CONTENT_LOADED" }, ({ payload }) => ({
            ...state,
            versionContent: payload.content,
        }))
        .with({ type: "LOADING_VERSIONS_STARTED" }, () => ({
            ...state,
            isLoadingVersions: true,
        }))
        .with({ type: "LOADING_VERSIONS_FINISHED" }, () => ({
            ...state,
            isLoadingVersions: false,
        }))
        .with({ type: "LOADING_CONTENT_STARTED" }, () => ({
            ...state,
            isLoadingContent: true,
        }))
        .with({ type: "LOADING_CONTENT_FINISHED" }, () => ({
            ...state,
            isLoadingContent: false,
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
}

export function useCodeFileVersions(): CodeFileVersionsState {
    const { state: fileStatus } = useSelectedCodeFile()
    const [state, dispatch] = useReducer(versionsReducer, initialState)

    // Derived state
    const selectedVersion = state.versions.find(version => version.id === state.selectedVersionId)

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
        if (!state.codeFile) {
            return
        }

        dispatch({ type: "LOADING_VERSIONS_STARTED" })
        state.codeFile
            .getVersions()
            .then(versions => {
                dispatch({ type: "VERSIONS_LOADED", payload: { versions } })
            })
            .finally(() => {
                dispatch({ type: "LOADING_VERSIONS_FINISHED" })
            })
    }, [state.codeFile])

    // Load version content when selected version changes
    useEffect(() => {
        if (!selectedVersion) {
            dispatch({ type: "VERSION_CONTENT_LOADED", payload: { content: undefined } })
            return
        }

        dispatch({ type: "LOADING_CONTENT_STARTED" })
        selectedVersion
            .getContent()
            .then(content => {
                dispatch({ type: "VERSION_CONTENT_LOADED", payload: { content } })
            })
            .finally(() => {
                dispatch({ type: "LOADING_CONTENT_FINISHED" })
            })
    }, [selectedVersion])

    // Actions
    const selectVersion = useCallback((id: string) => {
        dispatch({ type: "VERSION_SELECTED", payload: { versionId: id } })
    }, [])

    const restoreVersion = useCallback(async () => {
        if (!state.versionContent || !state.codeFile) {
            return
        }

        await state.codeFile.setFileContent(state.versionContent)
    }, [state.versionContent, state.codeFile])

    return {
        // Current state
        state: {
            codeFile: state.codeFile,
            versions: state.versions,
            selectedVersionId: state.selectedVersionId,
            versionContent: state.versionContent,
            isLoadingVersions: state.isLoadingVersions,
            isLoadingContent: state.isLoadingContent,
        },

        // Actions
        selectVersion,
        restoreVersion,
    }
}
