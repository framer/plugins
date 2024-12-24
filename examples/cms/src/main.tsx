import "framer-plugin/framer.css"

import React from "react"
import ReactDOM from "react-dom/client"
import { framer } from "framer-plugin"
import { App } from "./App.tsx"
import { PLUGIN_KEYS } from "./constants"
import { syncExistingCollection } from "./data"

const activeCollection = await framer.getManagedCollection()

const configuredCollectionId = await activeCollection.getPluginData(PLUGIN_KEYS.COLLECTION_ID)
const configuredSlugFieldId = await activeCollection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID)

const result = await syncExistingCollection(activeCollection, configuredCollectionId, configuredSlugFieldId)

if (result === "success") {
    await framer.closePlugin(`Synchronization successful`, {
        variant: "success",
    })
} else {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <App
                collection={activeCollection}
                dataSourceId={configuredCollectionId}
                slugFieldId={configuredSlugFieldId}
            />
        </React.StrictMode>
    )
}
