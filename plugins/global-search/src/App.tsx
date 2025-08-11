import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { DevToolsScene } from "./components/DevToolsScene"
import { IndexerProvider } from "./utils/indexer/IndexerProvider"

framer.showUI({
    position: "top right",
    width: 400,
    height: 600,
    resizable: true,
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
        <ErrorBoundary
            fallbackRender={({ error, resetErrorBoundary }) => (
                <div>
                    {error.message}
                    <button onClick={resetErrorBoundary}>Reset</button>
                </div>
            )}
        >
            <IndexerProvider>
                {activeScene === "dev-tools" ? (
                    <DevToolsScene />
                ) : (
                    <div>Welcome! This is under development. Select "Open Dev Tools" to get started.</div>
                )}
            </IndexerProvider>
        </ErrorBoundary>
    )
}
