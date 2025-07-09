import { framer } from "framer-plugin"
import { useEffect } from "react"
import { MutationState, useCodeFileVersions } from "../hooks/useCodeFileVersions"
import { StatusTypes, useSelectedCodeFile } from "../hooks/useSelectedCodeFile"
import CodeFileView from "./CodeFileView"
import { EmptyState } from "./EmptyState"
import ErrorMessage from "./ErrorMessage"

export default function App() {
    const { state: fileStatus } = useSelectedCodeFile()
    const { state, selectVersion, restoreVersion, clearErrors } = useCodeFileVersions()

    // Close plugin when restore is completed successfully
    useEffect(() => {
        if (state.restoreCompleted) {
            framer.closePlugin("Code version restored", {
                variant: "success",
            })
        }
        if (state.errors.restore) {
            framer.closePlugin("Couldn't restore version", {
                variant: "error",
            })
        }
    }, [state.restoreCompleted, state.errors.restore])

    useEffect(() => {
        if (state.restoreLoading === MutationState.Mutating) {
            framer.hideUI()
        }
    }, [state.restoreLoading])

    // Handle error states
    if (fileStatus.type === StatusTypes.ERROR) {
        return (
            <Layout>
                <ErrorMessage errorMessage={fileStatus.error} onRetryButtonClick={undefined} />
            </Layout>
        )
    }

    if (state.errors.versions) {
        return (
            <Layout>
                <ErrorMessage errorMessage={state.errors.versions} onRetryButtonClick={clearErrors} />
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
            <CodeFileView
                state={state}
                selectVersion={selectVersion}
                restoreVersion={restoreVersion}
                clearErrors={clearErrors}
            />
        </Layout>
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
