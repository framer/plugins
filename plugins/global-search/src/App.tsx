import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { DevToolsScene } from "./components/DevToolsScene"
import { ErrorScene } from "./components/ErrorScene"
import { SearchScene } from "./components/SearchScene"
import { IndexerProvider } from "./utils/indexer/IndexerProvider"
import { getPluginUiOptions } from "./utils/plugin-ui"

void framer.showUI(getPluginUiOptions({ query: undefined, hasResults: false }))

const projectInfo = await framer.getProjectInfo()

export function App() {
    const [activeScene, setActiveScene] = useState<"search" | "dev-tools">("search")

    useEffect(() => {
        void framer.setMenu([
            {
                label: "Open Dev Tools",
                onAction: () => {
                    setActiveScene(state => (state === "dev-tools" ? "search" : "dev-tools"))
                },
                checked: activeScene === "dev-tools",
            },
        ])
    })

    return (
        <ErrorBoundary FallbackComponent={ErrorScene}>
            <IndexerProvider projectId={projectInfo.id} projectName={projectInfo.name}>
                {activeScene === "dev-tools" && <DevToolsScene />}
                {activeScene === "search" && <SearchScene />}
            </IndexerProvider>
        </ErrorBoundary>
    )
}
