import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { DevToolsScene } from "./components/DevToolsScene"
import { ErrorScene } from "./components/ErrorScene"
import { SearchScene } from "./components/SearchScene"
import { IndexerProvider } from "./utils/indexer/IndexerProvider"
import { getPluginSize } from "./utils/plugin-size"

framer.showUI({
    ...getPluginSize({ query: undefined, hasResults: false }),
    resizable: false,
    position: "top right",
})

export function App() {
    const [activeScene, setActiveScene] = useState<"search" | "dev-tools">("search")

    useEffect(() => {
        framer.setMenu([
            {
                label: "Open Dev Tools",
                onAction: () => setActiveScene(state => (state === "dev-tools" ? "search" : "dev-tools")),
                checked: activeScene === "dev-tools",
            },
        ])
    })

    return (
        <ErrorBoundary FallbackComponent={ErrorScene}>
            <IndexerProvider>
                {activeScene === "dev-tools" && <DevToolsScene />}
                {activeScene === "search" && <SearchScene />}
            </IndexerProvider>
        </ErrorBoundary>
    )
}
