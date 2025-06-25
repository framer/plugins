import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App.tsx"
import { PLUGIN_KEYS, syncExistingCollection } from "./data"
import auth from "./auth"
import { Authenticate } from "./Login"

const activeCollection = await framer.getActiveManagedCollection()

const tokens = await auth.getTokens()

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

if (!tokens) {
    await new Promise<void>(resolve => {
        createRoot(root).render(
            <StrictMode>
                <Authenticate onAuthenticated={resolve} />
            </StrictMode>
        )
    })
}

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

    createRoot(root).render(
        <StrictMode>
            <App
                collection={activeCollection}
                previousDataSourceId={previousDataSourceId}
                previousSlugFieldId={previousSlugFieldId}
            />
        </StrictMode>
    )
}
