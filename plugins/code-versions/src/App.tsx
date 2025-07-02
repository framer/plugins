import { framer } from "framer-plugin"
import { useEffect } from "react"
import CodeFileView from "./components/CodeFileView"
import { useCodeFileVersions } from "./hooks/useCodeFileVersions"

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

    const { state, selectVersion, restoreVersion } = useCodeFileVersions()

    return state.codeFile ? (
        <CodeFileView state={state} selectVersion={selectVersion} restoreVersion={restoreVersion} />
    ) : (
        <div>No code file selected</div>
    )
}
