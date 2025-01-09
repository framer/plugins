import "framer-plugin/framer.css"

import React from "react"
import ReactDOM from "react-dom/client"
import { framer } from "framer-plugin"
import { App } from "./App.tsx"
import { syncExistingCollection, PLUGIN_KEYS } from "./data"

const activeCollection = await framer.getManagedCollection()

const previousDataSourceId = await activeCollection.getPluginData(PLUGIN_KEYS.DATA_SOURCE_ID)
const previousSlugFieldId = await activeCollection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID)

const { didSync } = await syncExistingCollection(activeCollection, previousDataSourceId, previousSlugFieldId)

if (didSync) {
    await framer.closePlugin("Synchronization successful", {
        variant: "success",
    })
} else {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <App
                collection={activeCollection}
                previousDataSourceId={previousDataSourceId}
                previousSlugFieldId={previousSlugFieldId}
            />
        </React.StrictMode>
    )
}
