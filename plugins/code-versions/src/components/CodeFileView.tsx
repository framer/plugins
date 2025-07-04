import type { CodeFileVersionsState } from "../hooks/useCodeFileVersions"
import { LoadingState, useCanRestoreVersion } from "../hooks/useCodeFileVersions"
import FileDiff from "./FileDiff"
import VersionsSidebar from "./VersionsSidebar"

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
                isLoading={state.versionsLoading === LoadingState.Initial}
            />
            <div className="bg-code-area-light dark:bg-code-area-dark overflow-auto relative">
                <div className="absolute inset-0 ms-3 me-4 mt-3">
                    {state.contentLoading === LoadingState.Initial ||
                    state.versionContent === undefined ||
                    currentContent === undefined ? null : (
                        <FileDiff original={state.versionContent} revised={currentContent} />
                    )}
                </div>
            </div>
            {!isCurrentVersion && canRestoreVersion ? (
                <div className="m-3">
                    <button
                        className="px-6 py-2 rounded-lg bg-tint text-framer-text-primary font-medium disabled:cursor-not-allowed w-full"
                        onClick={restoreVersion}
                        disabled={state.restoreLoading === LoadingState.Initial}
                    >
                        {state.restoreLoading === LoadingState.Initial ? "Restoring…" : "Restore"}
                    </button>
                </div>
            ) : null}
        </div>
    )
}
