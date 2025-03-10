import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"

import { App } from "./App.tsx"
import auth from "./auth"
import { syncExistingCollection, PLUGIN_KEYS } from "./data"
import { Authenticate } from "./Login.tsx"

const activeCollection = await framer.getActiveManagedCollection()

const tokens = await auth.getTokens()

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

if (!tokens) {
    await new Promise<void>(resolve => {
        ReactDOM.createRoot(root).render(
            <React.StrictMode>
                <Authenticate onAuthenticated={resolve} />
            </React.StrictMode>
        )
    })
}

const [previousBaseId, previousTableId, previousTableName, previousSlugFieldId] = await Promise.all([
    activeCollection.getPluginData(PLUGIN_KEYS.BASE_ID),
    activeCollection.getPluginData(PLUGIN_KEYS.TABLE_ID),
    activeCollection.getPluginData(PLUGIN_KEYS.TABLE_NAME),
    activeCollection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID),
])

const { didSync } = await syncExistingCollection(
    activeCollection,
    previousBaseId,
    previousTableId,
    previousTableName,
    previousSlugFieldId
)

if (didSync) {
    await framer.closePlugin("Synchronization successful", {
        variant: "success",
    })
} else {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <App
                collection={activeCollection}
                previousBaseId={previousBaseId}
                previousTableId={previousTableId}
                previousSlugFieldId={previousSlugFieldId}
            />
        </React.StrictMode>
    )
}
