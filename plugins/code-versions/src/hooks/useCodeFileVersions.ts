import { type CodeFile, type CodeFileVersion, useIsAllowedTo } from "framer-plugin"
import { useCallback, useEffect, useReducer, useRef } from "react"
import { match } from "ts-pattern"
import { StatusTypes, useSelectedCodeFile } from "./useSelectedCodeFile"

export function useCodeFileVersions(): CodeFileVersionsState {
    const { state: fileStatus } = useSelectedCodeFile()
    const [state, dispatch] = useReducer(versionsReducer, initialState)

    // Refs to track current operations and abort controllers
    const versionsAbortControllerRef = useRef<AbortController | null>(null)
    const contentAbortControllerRef = useRef<AbortController | null>(null)

    // Derived state
    // this happens on every render, but should be fast enough, as useMemo isn't free either
    const selectedVersion = state.versions.find(version => version.id === state.selectedVersionId)

    // Handle file selection changes
    useEffect(() => {
        if (fileStatus.type !== StatusTypes.SELECTED_CODE_FILE) {
            // Cancel any ongoing operations
            versionsAbortControllerRef.current?.abort()
            versionsAbortControllerRef.current = null
            contentAbortControllerRef.current?.abort()
            contentAbortControllerRef.current = null

            dispatch({ type: VersionsActionType.StateResetCompleted })
            return
        }

        dispatch({ type: VersionsActionType.CodeFileSelected, payload: { codeFile: fileStatus.codeFile } })
    }, [fileStatus])

    // Load versions when codeFile changes
    useEffect(() => {
        if (!state.codeFile) return

        // Cancel previous versions operation if it's still running
        versionsAbortControllerRef.current?.abort()

        // Create new abort controller for this operation
        const abortController = new AbortController()
        versionsAbortControllerRef.current = abortController

        loadVersions(dispatch, state.codeFile, abortController)

        // Cleanup function
        return () => {
            abortController.abort()
            // Only clear the ref if it still points to this controller
            if (versionsAbortControllerRef.current === abortController) {
                versionsAbortControllerRef.current = null
            }
        }
    }, [state.codeFile])

    // Load version content when selected version changes
    useEffect(() => {
        if (!selectedVersion) {
            dispatch({ type: VersionsActionType.VersionContentLoaded, payload: { content: undefined } })
            return
        }

        // Cancel previous content operation if it's still running
        contentAbortControllerRef.current?.abort()

        // Create new abort controller for this operation
        const abortController = new AbortController()
        contentAbortControllerRef.current = abortController

        loadVersionContent(dispatch, selectedVersion, abortController)

        // Cleanup function
        return () => {
            abortController.abort()
            // Only clear the ref if it still points to this controller
            if (contentAbortControllerRef.current === abortController) {
                contentAbortControllerRef.current = null
            }
        }
    }, [selectedVersion])

    // Actions
    const selectVersion = useCallback((id: string) => {
        dispatch({ type: VersionsActionType.VersionSelected, payload: { versionId: id } })
    }, [])

    const restoreVersion = useCallback(async () => {
        if (!state.versionContent || !state.codeFile) return

        dispatch({ type: VersionsActionType.RestoreStarted })

        try {
            await state.codeFile.setFileContent(state.versionContent)
            dispatch({ type: VersionsActionType.RestoreCompleted })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to restore version"
            dispatch({ type: VersionsActionType.RestoreError, payload: { error: errorMessage } })
        }
    }, [state.versionContent, state.codeFile])

    const clearErrors = useCallback(() => {
        dispatch({ type: VersionsActionType.ErrorsCleared })
    }, [])

    return {
        state: {
            codeFile: state.codeFile,
            versions: state.versions,
            selectedVersionId: state.selectedVersionId,
            versionContent: state.versionContent,
            versionsLoading: state.versionsLoading,
            contentLoading: state.contentLoading,
            restoreLoading: state.restoreLoading,
            restoreCompleted: state.restoreCompleted,
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

export enum LoadingState {
    Idle,
    Initial,
    Refreshing,
}

export enum MutationState {
    Idle,
    Mutating,
    Done,
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
    RestoreStarted = "RESTORE_STARTED",
    RestoreCompleted = "RESTORE_COMPLETED",
    RestoreError = "RESTORE_ERROR",
    ErrorsCleared = "ERRORS_CLEARED",
    StateResetCompleted = "STATE_RESET_COMPLETED",
    OperationCancelled = "OPERATION_CANCELLED",
}

interface VersionsState {
    codeFile: CodeFile | undefined
    versions: readonly CodeFileVersion[]
    selectedVersionId: string | undefined
    versionContent: string | undefined
    versionsLoading: LoadingState
    contentLoading: LoadingState
    restoreLoading: MutationState
    restoreCompleted: boolean
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
    | { type: VersionsActionType.RestoreStarted }
    | { type: VersionsActionType.RestoreCompleted }
    | { type: VersionsActionType.RestoreError; payload: { error: string } }
    | { type: VersionsActionType.ErrorsCleared }
    | { type: VersionsActionType.StateResetCompleted }
    | { type: VersionsActionType.OperationCancelled; payload: { operation: "versions" | "content" } }

export interface CodeFileVersionsState {
    // Current state
    state: VersionsState

    // Actions
    selectVersion: (id: string) => void
    restoreVersion: () => Promise<void>
    clearErrors: () => void
}

function versionsReducer(state: VersionsState, action: VersionsAction): VersionsState {
    return match(action)
        .returnType<VersionsState>()
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
                    restoreLoading: MutationState.Idle,
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
            selectedVersionId: !state.selectedVersionId
                ? getDefaultSelectedVersionId(payload.versions)
                : state.selectedVersionId,
            errors: { ...state.errors, versions: undefined },
        }))
        .with({ type: VersionsActionType.VersionSelected }, ({ payload }) => ({
            ...state,
            selectedVersionId: payload.versionId,
            versionContent: state.selectedVersionId === payload.versionId ? state.versionContent : undefined,
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
        .with({ type: VersionsActionType.RestoreStarted }, () => ({
            ...state,
            restoreLoading: MutationState.Mutating,
            errors: { ...state.errors, restore: undefined },
        }))
        .with({ type: VersionsActionType.RestoreCompleted }, () => ({
            ...state,
            restoreLoading: MutationState.Done,
            restoreCompleted: true,
        }))
        .with({ type: VersionsActionType.RestoreError }, ({ payload }) => ({
            ...state,
            restoreLoading: MutationState.Done,
            errors: { ...state.errors, restore: payload.error },
        }))
        .with({ type: VersionsActionType.ErrorsCleared }, () => ({
            ...state,
            errors: {},
        }))
        .with({ type: VersionsActionType.StateResetCompleted }, () => initialState)
        .with({ type: VersionsActionType.OperationCancelled }, ({ payload }) => ({
            ...state,
            versionsLoading: payload.operation === "versions" ? LoadingState.Idle : state.versionsLoading,
            contentLoading: payload.operation === "content" ? LoadingState.Idle : state.contentLoading,
        }))
        .exhaustive()
}

// Helper function to determine the default selected version
// Prefers the second-to-last version (n-1) if available, otherwise falls back to current (first)
function getDefaultSelectedVersionId(versions: readonly CodeFileVersion[]): string | undefined {
    if (versions.length === 0) return undefined
    if (versions.length === 1) return versions[0]?.id
    return versions[1]?.id // Second version (index 1) is the n-1 version
}

// Helper function to load versions with abort controller
async function loadVersions(
    dispatch: React.Dispatch<VersionsAction>,
    codeFile: CodeFile,
    abortController: AbortController
) {
    dispatch({ type: VersionsActionType.VersionsLoadStarted })
    try {
        const versions = await codeFile.getVersions()

        // Check if operation was cancelled
        if (abortController.signal.aborted) {
            dispatch({ type: VersionsActionType.OperationCancelled, payload: { operation: "versions" } })
            return
        }

        dispatch({ type: VersionsActionType.VersionsLoaded, payload: { versions } })
    } catch (error) {
        // Don't dispatch error if operation was cancelled
        if (abortController.signal.aborted) {
            dispatch({ type: VersionsActionType.OperationCancelled, payload: { operation: "versions" } })
            return
        }

        const errorMessage = error instanceof Error ? error.message : "Failed to load versions"
        dispatch({ type: VersionsActionType.VersionsError, payload: { error: errorMessage } })
    }
}

// Helper function to load version content with abort controller
async function loadVersionContent(
    dispatch: React.Dispatch<VersionsAction>,
    version: CodeFileVersion,
    abortController: AbortController
) {
    dispatch({ type: VersionsActionType.ContentLoadStarted })

    try {
        const content = await version.getContent()

        // Check if operation was cancelled
        if (abortController.signal.aborted) {
            dispatch({ type: VersionsActionType.OperationCancelled, payload: { operation: "content" } })
            return
        }

        dispatch({ type: VersionsActionType.VersionContentLoaded, payload: { content } })
    } catch (error) {
        // Don't dispatch error if operation was cancelled
        if (abortController.signal.aborted) {
            dispatch({ type: VersionsActionType.OperationCancelled, payload: { operation: "content" } })
            return
        }

        const errorMessage = error instanceof Error ? error.message : "Failed to load version content"
        dispatch({ type: VersionsActionType.ContentError, payload: { error: errorMessage } })
    }
}

const initialState: VersionsState = {
    codeFile: undefined,
    versions: [],
    selectedVersionId: undefined,
    versionContent: undefined,
    versionsLoading: LoadingState.Idle,
    contentLoading: LoadingState.Idle,
    restoreLoading: MutationState.Idle,
    restoreCompleted: false,
    errors: {},
}
