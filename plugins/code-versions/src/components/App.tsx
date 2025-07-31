import { framer } from "framer-plugin"
import { useEffect } from "react"
import { isInitialLoading, RestoreState, useCodeFileVersions } from "../hooks/useCodeFileVersions"
import { StatusTypes, useSelectedCodeFile } from "../hooks/useSelectedCodeFile"
import { EmptyState } from "./EmptyState"
import { ErrorMessage } from "./ErrorMessage"
import { Spinner } from "./Spinner"
import { VersionColumn } from "./VersionColumn"
import { VersionsSidebar } from "./VersionsSidebar"

export function App() {
    const { state: fileStatus } = useSelectedCodeFile()
    const { state, selectVersion, restoreVersion, clearErrors } = useCodeFileVersions()

    useEffect(() => {
        switch (state.restore.status) {
            case RestoreState.Succeeded:
                void framer.closePlugin("Code Version has been restored", {
                    variant: "success",
                })
                return
            case RestoreState.Failed:
                void framer.closePlugin("Couldn't restore Code Version", {
                    variant: "error",
                })
                return
            case RestoreState.Mutating:
                void framer.hideUI()
                return
        }
    }, [state.restore.status])

    // Handle error states
    if (fileStatus.type === StatusTypes.ERROR) {
        return (
            <AppLayout>
                <ErrorMessage errorMessage={fileStatus.error} onRetryButtonClick={undefined} />
            </AppLayout>
        )
    }

    if (state.versions.error) {
        return (
            <AppLayout>
                <ErrorMessage errorMessage={state.versions.error} onRetryButtonClick={clearErrors} />
            </AppLayout>
        )
    }

    if (!state.codeFile) {
        return (
            <AppLayout>
                <EmptyState />
            </AppLayout>
        )
    }

    const isLoadingVersions = isInitialLoading(state.versions)
    const isLoadingContent = isLoadingVersions || isInitialLoading(state.content)

    return (
        <AppLayout>
            {isLoadingVersions ? (
                <Spinner className="row-span-2" />
            ) : (
                <VersionsSidebar
                    className="row-span-2"
                    versions={state.versions.data}
                    selectedId={state.selectedVersionId}
                    onSelect={selectVersion}
                />
            )}

            {isLoadingContent ? (
                <Spinner />
            ) : (
                <VersionColumn state={state} clearErrors={clearErrors} restoreVersion={restoreVersion} />
            )}
        </AppLayout>
    )
}

function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="h-screen flex flex-col overflow-hidden scheme-light dark:scheme-dark">
            <hr className="ms-3 border-t border-framer-divider" />
            <div className="grid grid-cols-[var(--width-versions)_1fr] grid-rows-[1fr_auto] h-screen bg-bg-base text-text-base">
                {children}
            </div>
        </div>
    )
}
