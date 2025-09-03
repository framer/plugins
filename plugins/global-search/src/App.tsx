import { framer } from "framer-plugin"
import { ErrorBoundary } from "react-error-boundary"
import { ErrorScene } from "./components/ErrorScene"
import { SearchScene } from "./components/SearchScene"
import { IndexerProvider } from "./utils/indexer/IndexerProvider"
import { getPluginUiOptions } from "./utils/plugin-ui"

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
