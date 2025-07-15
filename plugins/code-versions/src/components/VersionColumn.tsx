import { type CodeFileVersionsState, RestoreState, useCanRestoreVersion } from "../hooks/useCodeFileVersions"
import { Code } from "./Code"
import { ErrorMessage } from "./ErrorMessage"

interface VersionColumnProps {
    state: CodeFileVersionsState["state"]
    clearErrors: CodeFileVersionsState["clearErrors"]
    restoreVersion: CodeFileVersionsState["restoreVersion"]
}

export function VersionColumn({ state, clearErrors, restoreVersion }: VersionColumnProps) {
    const canRestoreVersion = useCanRestoreVersion()
    if (state.content.error) {
        return (
            <div className="bg-code-area-light dark:bg-code-area-dark relative overflow-hidden">
                <ErrorMessage errorMessage={state.content.error} onRetryButtonClick={clearErrors} />
            </div>
        )
    }

    const currentContent = state.codeFile?.content
    const isCurrentVersion = state.codeFile?.versionId === state.selectedVersionId

    return (
        <>
            <div className="bg-code-area-light dark:bg-code-area-dark relative overflow-hidden">
                <div className="absolute inset-0 mx-3 mt-3">
                    <div className="overflow-auto scrollbar-hidden h-full pb-3">
                        {state.content.data === undefined || currentContent === undefined ? null : (
                            <Code
                                original={state.content.data}
                                revised={currentContent}
                                isCurrentVersion={isCurrentVersion}
                            />
                        )}
                    </div>
                </div>
            </div>
            {!isCurrentVersion && canRestoreVersion ? (
                <div className="border-t border-framer-divider p-3">
                    <button
                        className="px-6 py-2 rounded-lg bg-tint text-framer-text-primary font-medium disabled:cursor-not-allowed w-full hover:bg-framer-button-hover-light dark:hover:bg-framer-button-hover-dark"
                        onClick={restoreVersion}
                        // We hide the plugin when we restore, this is just a safety measure
                        disabled={state.restore.status === RestoreState.Mutating}
                    >
                        Restore
                    </button>
                </div>
            ) : null}
        </>
    )
}
