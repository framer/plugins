import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.cms.tsx"
import { PLUGIN_KEYS, syncExistingCollection } from "./data"
import { AppCanvas } from "./App.canvas.tsx"

const previousBoardToken = await framer.getPluginData(PLUGIN_KEYS.SPACE_ID)

if (framer.mode === "canvas") {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    createRoot(root).render(
        <StrictMode>
            <AppCanvas previousBoardToken={previousBoardToken} />
        </StrictMode>
    )
} else {
    const activeCollection = await framer.getActiveManagedCollection()

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
                    previousBoardToken={previousBoardToken}
                />
            </StrictMode>
        )
    }
}
