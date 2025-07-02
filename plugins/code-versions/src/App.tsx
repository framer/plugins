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

    // Handle error states
    if (fileStatus.type === StatusTypes.ERROR) {
        return (
            <div className="flex items-center justify-center h-full p-6">
                <div className="text-center">
                    <h2 className="text-lg font-semibold mb-2 text-red-600">Error</h2>
                    <p className="text-sm text-gray-600 mb-4">{fileStatus.error}</p>
                    <p className="text-xs text-gray-500">
                        This might be due to insufficient permissions. Please check your project permissions.
                    </p>
                </div>
            </div>
        )
    }

    return state.codeFile ? (
        <div className="h-screen flex flex-col">
            {/* Error banner for versions loading error */}
            {state.errors.versions && (
                <div className="bg-red-50 border-b border-red-200 p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <span className="text-red-600 text-sm font-medium">Failed to load versions:</span>
                            <span className="text-red-500 text-sm ml-2">{state.errors.versions}</span>
                        </div>
                        <button onClick={clearErrors} className="text-red-600 hover:text-red-800 text-sm font-medium">
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Error banner for content loading error */}
            {state.errors.content && (
                <div className="bg-yellow-50 border-b border-yellow-200 p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <span className="text-yellow-600 text-sm font-medium">Failed to load content:</span>
                            <span className="text-yellow-500 text-sm ml-2">{state.errors.content}</span>
                        </div>
                        <button
                            onClick={clearErrors}
                            className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Error banner for restore error */}
            {state.errors.restore && (
                <div className="bg-red-50 border-b border-red-200 p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <span className="text-red-600 text-sm font-medium">Failed to restore version:</span>
                            <span className="text-red-500 text-sm ml-2">{state.errors.restore}</span>
                        </div>
                        <button onClick={clearErrors} className="text-red-600 hover:text-red-800 text-sm font-medium">
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1">
                <CodeFileView state={state} selectVersion={selectVersion} restoreVersion={restoreVersion} />
            </div>
        </div>
    ) : (
        <div className="flex items-center justify-center h-full p-6">
            <div className="text-center">
                <h2 className="text-lg font-semibold mb-2">No Code File Selected</h2>
                <p className="text-sm text-gray-600">
                    Select a component in the canvas or open a code file to view its versions.
                </p>
            </div>
        </div>
    )
}
