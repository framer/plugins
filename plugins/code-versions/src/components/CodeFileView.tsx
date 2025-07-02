import { useCodeFileVersions } from "../hooks/useCodeFileVersions"
import FileDiff from "./FileDiff"
import VersionsSidebar from "./VersionsSidebar"

export default function CodeFileView() {
    const { state, selectVersion, restoreVersion } = useCodeFileVersions()

    const currentContent = state.codeFile?.content ?? ""

    return (
        <div className="grid grid-cols-[var(--width-versions)_1fr] grid-rows-[1fr_auto] h-screen bg-bg-base text-text-base">
            <VersionsSidebar
                className="row-span-2"
                versions={state.versions}
                selectedId={state.selectedVersionId}
                onSelect={selectVersion}
                isLoading={state.isLoadingVersions}
            />
            <div className="bg-bg-secondary overflow-hidden">
                {state.isLoadingContent ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Loading version content...
                    </div>
                ) : (
                    <FileDiff original={state.versionContent ?? ""} revised={currentContent} />
                )}
            </div>
            <button
                className="px-6 py-2 rounded bg-tint text-white font-semibold hover:bg-tint-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={state.versionContent === currentContent || !state.selectedVersionId || state.isLoadingContent}
                onClick={restoreVersion}
            >
                {state.isLoadingContent ? "Loading..." : "Restore"}
            </button>
        </div>
    )
}
