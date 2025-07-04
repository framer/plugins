import { framer } from "framer-plugin"
import { useEffect } from "react"
import CodeFileView from "./components/CodeFileView"
import { useCodeFileVersions } from "./hooks/useCodeFileVersions"
import { StatusTypes, useSelectedCodeFile } from "./hooks/useSelectedCodeFile"

export default function App() {
    useEffect(() => {
        framer.showUI({
            width: 760,
            height: 480,
            minWidth: 600,
            minHeight: 360,
            maxWidth: 1200,
            maxHeight: 800,
            resizable: true,
            position: "bottom right",
        })
    }, [])

    const { state: fileStatus } = useSelectedCodeFile()
    const { state, selectVersion, restoreVersion, clearErrors } = useCodeFileVersions()

    // Close plugin when restore is completed successfully
    useEffect(() => {
        if (state.restoreCompleted) {
            framer.closePlugin("Code version restored", {
                variant: "success",
            })
        }
    }, [state.restoreCompleted])

    // Handle error states
    if (fileStatus.type === StatusTypes.ERROR) {
        return (
            <Layout>
                <div className="text-center">
                    <h2 className="text-lg font-semibold mb-2 text-red-600">Error</h2>
                    <p className="text-sm text-gray-600 mb-4">{fileStatus.error}</p>
                </div>
            </Layout>
        )
    }

    if (!state.codeFile) {
        return (
            <Layout>
                <EmptyState />
            </Layout>
        )
    }

    return (
        <Layout>
            {/* Error banner for versions loading error */}
            {state.errors.versions && (
                <div className="sticky top-0 bg-white border-b border-framer-divider p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <span className="text-framer-text-primary text-sm font-medium">
                                Failed to load versions:
                            </span>
                            <span className="text-framer-text-secondary text-sm ml-2">{state.errors.versions}</span>
                        </div>
                        <button
                            onClick={clearErrors}
                            className="text-framer-text-primary hover:text-framer-text-base text-sm font-medium w-min px-2"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Error banner for content loading error */}
            {state.errors.content && (
                <div className="border-b border-framer-divider p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <span className="text-framer-text-primary text-sm font-medium">
                                Failed to load content:
                            </span>
                            <span className="text-framer-text-secondary text-sm ml-2">{state.errors.content}</span>
                        </div>
                        <button
                            onClick={clearErrors}
                            className="text-framer-text-primary hover:text-framer-text-base text-sm font-medium px-2"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Error banner for restore error */}
            {state.errors.restore && (
                <div className="border-b border-framer-divider p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <span className="text-framer-text-primary text-sm font-medium">
                                Failed to restore version:
                            </span>
                            <span className="text-framer-text-secondary text-sm ml-2">{state.errors.restore}</span>
                        </div>
                        <button
                            onClick={clearErrors}
                            className="text-framer-text-primary hover:text-framer-text-base text-sm font-medium px-2"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1">
                <CodeFileView state={state} selectVersion={selectVersion} restoreVersion={restoreVersion} />
            </div>
        </Layout>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full space-y-3">
            <img src="/logo.svg" className="rounded-lg" />

            <div className="space-y-2 text-center max-w-36">
                <h2 className="font-semibold text-framer-text-primary text-xs leading-[1.2]">Code Versions</h2>
                <p className="text-framer-text-tertiary text-xs leading-[1.5]">
                    Select a Code Component to restore previous versions.
                </p>
            </div>
        </div>
    )
}

function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="h-screen flex flex-col overflow-hidden scheme-light dark:scheme-dark">
            <hr className="ms-3 border-t border-framer-divider" />
            {children}
        </div>
    )
}
