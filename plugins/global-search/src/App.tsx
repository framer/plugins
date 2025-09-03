import { framer } from "framer-plugin"
import { ErrorBoundary } from "react-error-boundary"
import { ErrorScene } from "./components/ErrorScene"
import { SearchScene } from "./components/SearchScene"
import { IndexerProvider } from "./utils/indexer/IndexerProvider"
import { getPluginUiOptions } from "./utils/plugin-ui"

// Close the plugin when "open combination" or "escape" is pressed
document.addEventListener("keydown", event => {
    const isModifierPressed = event.metaKey || event.ctrlKey
    const isOwnOpenCombination = isModifierPressed && event.shiftKey && event.code === "KeyF"
    const isEscape = event.key === "Escape"

    if (!isEscape && !isOwnOpenCombination) return

    // This will close the plugin, but also show a message that the plugin was closed.
    // We might add a "silent" option later.
    void framer.closePlugin()
})

void framer.showUI(getPluginUiOptions({ query: undefined, hasResults: false }))

const projectInfo = await framer.getProjectInfo()

export function App() {
    return (
        <ErrorBoundary FallbackComponent={ErrorScene}>
            <IndexerProvider projectId={projectInfo.id} projectName={projectInfo.name}>
                <SearchScene />
            </IndexerProvider>
        </ErrorBoundary>
    )
}
