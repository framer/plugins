import { type CodeFile, type CodeFileVersion, useIsAllowedTo } from "framer-plugin"
import retry from "p-retry"
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
    const selectedVersion = state.versions.data.find(version => version.id === state.selectedVersionId)

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

        void loadVersions(dispatch, state.codeFile, abortController)

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

        void loadVersionContent(dispatch, selectedVersion, abortController)

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

    const restoreVersion = useCallback(() => {
        const task = async () => {
            if (!state.content.data || !state.codeFile) return

            dispatch({ type: VersionsActionType.RestoreStarted })

            try {
                await state.codeFile.setFileContent(state.content.data)
                dispatch({ type: VersionsActionType.RestoreCompleted })
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Failed to restore version"
                dispatch({ type: VersionsActionType.RestoreError, payload: { error: errorMessage } })
            }
        }

        void task()
    }, [state.content.data, state.codeFile])

    const clearErrors = useCallback(() => {
        versionsAbortControllerRef.current?.abort()
        contentAbortControllerRef.current?.abort()

        const abortController = new AbortController()
        versionsAbortControllerRef.current = abortController
        contentAbortControllerRef.current = abortController

        if (state.codeFile) {
            void loadVersions(dispatch, state.codeFile, abortController)
        }

        if (selectedVersion) {
            void loadVersionContent(dispatch, selectedVersion, abortController)
        }
        dispatch({ type: VersionsActionType.ErrorsCleared })
    }, [state.codeFile, selectedVersion])

    return {
        state,

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

export enum RestoreState {
    Idle,
    Mutating,
    Succeeded,
    Failed,
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

interface DataState<T> {
    data: T | undefined
    status: LoadingState
    error?: string
}

export const isInitialLoading = <T>(state: DataState<T>) => {
    return state.status === LoadingState.Initial
}

interface VersionsState {
    codeFile: CodeFile | undefined
    selectedVersionId: string | undefined

    versions: {
        data: readonly CodeFileVersion[]
        status: LoadingState
        error?: string
    }

    content: {
        data: string | undefined
        status: LoadingState
        error?: string
    }

    restore: {
        status: RestoreState
        error?: string
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
    restoreVersion: () => void
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
                    versions: {
                        data: [],
                        status: LoadingState.Initial,
                        error: undefined,
                    },
                    selectedVersionId: undefined,
                    content: {
                        data: undefined,
                        status: LoadingState.Initial,
                        error: undefined,
                    },
                    restore: {
                        status: RestoreState.Idle,
                        error: undefined,
                    },
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
            versions: {
                ...state.versions,
                status: state.versions.status === LoadingState.Initial ? LoadingState.Initial : LoadingState.Refreshing,
                error: undefined,
            },
        }))
        .with({ type: VersionsActionType.VersionsLoaded }, ({ payload }) => ({
            ...state,
            versions: {
                ...state.versions,
                data: payload.versions,
                status: LoadingState.Idle,
                error: undefined,
            },
            selectedVersionId: state.selectedVersionId ?? getDefaultSelectedVersionId(payload.versions),
        }))
        .with({ type: VersionsActionType.VersionSelected }, ({ payload }) => ({
            ...state,
            selectedVersionId: payload.versionId,
            content: {
                ...state.content,
                data: state.selectedVersionId === payload.versionId ? state.content.data : undefined,
                error: undefined,
            },
        }))
        .with({ type: VersionsActionType.ContentLoadStarted }, () => ({
            ...state,
            content: {
                ...state.content,
                status: state.content.data == null ? LoadingState.Initial : LoadingState.Refreshing,
                error: undefined,
            },
        }))
        .with({ type: VersionsActionType.VersionContentLoaded }, ({ payload }) => ({
            ...state,
            content: {
                ...state.content,
                data: payload.content,
                status: LoadingState.Idle,
                error: undefined,
            },
        }))
        .with({ type: VersionsActionType.VersionsError }, ({ payload }) => ({
            ...state,
            versions: {
                ...state.versions,
                status: LoadingState.Idle,
                error: payload.error,
            },
        }))
        .with({ type: VersionsActionType.ContentError }, ({ payload }) => ({
            ...state,
            content: {
                ...state.content,
                status: LoadingState.Idle,
                error: payload.error,
            },
        }))
        .with({ type: VersionsActionType.RestoreStarted }, () => ({
            ...state,
            restore: {
                ...state.restore,
                status: RestoreState.Mutating,
                error: undefined,
            },
        }))
        .with({ type: VersionsActionType.RestoreCompleted }, () => ({
            ...state,
            restore: {
                ...state.restore,
                status: RestoreState.Succeeded,
            },
        }))
        .with({ type: VersionsActionType.RestoreError }, ({ payload }) => ({
            ...state,
            restore: {
                ...state.restore,
                status: RestoreState.Failed,
                error: payload.error,
            },
        }))
        .with({ type: VersionsActionType.ErrorsCleared }, () => ({
            ...state,
            versions: {
                ...state.versions,
                error: undefined,
            },
            content: {
                ...state.content,
                error: undefined,
            },
            restore: {
                ...state.restore,
                error: undefined,
            },
        }))
        .with({ type: VersionsActionType.StateResetCompleted }, () => initialState)
        .with({ type: VersionsActionType.OperationCancelled }, ({ payload }) => ({
            ...state,
            content: {
                ...state.content,
                status: payload.operation === "content" ? LoadingState.Idle : state.content.status,
            },
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

const RETRY_OPTIONS = {
    retries: 3,
    minTimeout: 250,
}

// Helper function to load versions with abort controller and retry logic and retry logic
async function loadVersions(
    dispatch: React.Dispatch<VersionsAction>,
    codeFile: CodeFile,
    abortController: AbortController
) {
    dispatch({ type: VersionsActionType.VersionsLoadStarted })
    try {
        const versions = await retry(() => codeFile.getVersions(), {
            ...RETRY_OPTIONS,
            signal: abortController.signal,
        })
        if (abortController.signal.aborted) {
            dispatch({ type: VersionsActionType.OperationCancelled, payload: { operation: "versions" } })
            return
        }
        dispatch({ type: VersionsActionType.VersionsLoaded, payload: { versions } })
    } catch (error) {
        if (abortController.signal.aborted) {
            dispatch({ type: VersionsActionType.OperationCancelled, payload: { operation: "versions" } })
            return
        }
        const errorMessage = error instanceof Error ? error.message : "Failed to load versions"
        dispatch({ type: VersionsActionType.VersionsError, payload: { error: errorMessage } })
    }
}

// Helper function to load version content with abort controller and retry logic
async function loadVersionContent(
    dispatch: React.Dispatch<VersionsAction>,
    version: CodeFileVersion,
    abortController: AbortController
) {
    dispatch({ type: VersionsActionType.ContentLoadStarted })
    try {
        const content = await retry(() => version.getContent(), {
            ...RETRY_OPTIONS,
            signal: abortController.signal,
        })
        if (abortController.signal.aborted) {
            dispatch({ type: VersionsActionType.OperationCancelled, payload: { operation: "content" } })
            return
        }
        dispatch({ type: VersionsActionType.VersionContentLoaded, payload: { content } })
    } catch (error) {
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
    selectedVersionId: undefined,
    versions: {
        data: [],
        status: LoadingState.Idle,
        error: undefined,
    },
    content: {
        data: undefined,
        status: LoadingState.Idle,
        error: undefined,
    },
    restore: {
        status: RestoreState.Idle,
        error: undefined,
    },
}
