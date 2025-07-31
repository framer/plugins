import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { importData } from "./data.ts"

const mode = framer.mode
const collection = await framer.getActiveManagedCollection()

const rssSourceId = await collection.getPluginData("rssSourceId")
if (mode === "syncManagedCollection" && rssSourceId) {
    const isAllowedToImportData = framer.isAllowedTo(
        "ManagedCollection.addItems",
        "ManagedCollection.removeItems",
        "ManagedCollection.setFields",
        "ManagedCollection.setPluginData"
    )

    if (!isAllowedToImportData) {
        await framer.closePlugin("You don't have permission to import data.", { variant: "error" })
    }

    try {
        await importData(collection, rssSourceId)
        await framer.closePlugin()
    } catch {
        // Failed to synchronize - show configuration
    }
}

const root = document.getElementById("root")
if (!root) {
    throw new Error("Root element not found")
}

void framer.showUI({
    position: "top right",
    width: 280,
    height: 305,
})

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App collection={collection} initialRssSourceId={rssSourceId} />
    </React.StrictMode>
)
