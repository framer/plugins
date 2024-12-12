import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"
import { App, importData } from "./App.tsx"

async function runPlugin() {
    const mode = framer.mode
    const collection = await framer.getManagedCollection()

    if (mode === "syncManagedCollection") {
        try {
            await importData(collection)
            await framer.closePlugin()
        } catch {
            // Failed to synchronize - show configuration
        }
    }

    const root = document.getElementById("root")
    if (!root) {
        throw new Error("Root element not found")
    }

    framer.showUI({
        position: "top right",
        width: 280,
        height: 305,
    })

    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <App collection={collection} />
        </React.StrictMode>
    )
}

runPlugin()
