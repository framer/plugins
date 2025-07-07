import { lazy, Suspense } from "react"
import {
    type CodeFileVersionsState,
    LoadingState,
    MutationState,
    useCanRestoreVersion,
} from "../hooks/useCodeFileVersions"
import FileDiff from "./FileDiff"
import VersionsSidebar from "./VersionsSidebar"

const CurrentCode = lazy(() => import("./CurrentCode").then(module => ({ default: module.default })))

interface CodeFileViewProps {
    state: CodeFileVersionsState["state"]
    selectVersion: CodeFileVersionsState["selectVersion"]
    restoreVersion: CodeFileVersionsState["restoreVersion"]
}

export default function CodeFileView({ state, selectVersion, restoreVersion }: CodeFileViewProps) {
    const currentContent = state.codeFile?.content

    const isCurrentVersion = state.codeFile?.versionId === state.selectedVersionId
    const canRestoreVersion = useCanRestoreVersion()

    return (
        <div className="grid grid-cols-[var(--width-versions)_1fr] grid-rows-[1fr_auto] h-screen bg-bg-base text-text-base">
            <VersionsSidebar
                className="row-span-2"
                versions={state.versions}
                selectedId={state.selectedVersionId}
                onSelect={selectVersion}
            />
            <div className="bg-code-area-light dark:bg-code-area-dark overflow-y-auto relative scrollbar-hidden">
                <div className="absolute inset-0 ms-3 me-4 mt-3">
                    {/* The overflow-x-auto here ensures scrollbars appear in the correct position when enabled by user styles */}
                    <div className="overflow-x-auto scrollbar-hidden">
                        {state.contentLoading === LoadingState.Initial ||
                        state.versionContent === undefined ||
                        currentContent === undefined ? null : (
                            <Code
                                original={state.versionContent}
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
                        disabled={state.restoreLoading === MutationState.Mutating}
                    >
                        Restore
                    </button>
                </div>
            ) : null}
        </div>
    )
}

function Code({
    original,
    revised,
    isCurrentVersion,
}: {
    original: string
    revised: string
    isCurrentVersion: boolean
}) {
    if (isCurrentVersion || original === revised) {
        return (
            // It will fade in once loaded
            <Suspense fallback={null}>
                <CurrentCode code={original} />
            </Suspense>
        )
    }

    return <FileDiff original={original} revised={revised} />
}
