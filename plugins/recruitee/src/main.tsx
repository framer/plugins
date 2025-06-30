import "framer-plugin/framer.css"
import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import { PLUGIN_KEYS, syncExistingCollection } from "./data"

const previousBoardToken = await framer.getPluginData(PLUGIN_KEYS.SPACE_ID)
const activeCollection = await framer.getActiveManagedCollection()

const previousDataSourceId = await activeCollection.getPluginData(PLUGIN_KEYS.DATA_SOURCE_ID)
const previousSlugFieldId = await activeCollection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID)
const previousCollectionBoardToken = await activeCollection.getPluginData(PLUGIN_KEYS.SPACE_ID)
const previousCompanyId = await framer.getPluginData(PLUGIN_KEYS.COMPANY_ID)

const { didSync } = await syncExistingCollection(
    activeCollection,
    previousDataSourceId,
    previousSlugFieldId,
    previousBoardToken,
    previousCompanyId
)

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
                previousBoardToken={previousCollectionBoardToken ?? previousBoardToken}
                previousCompanyId={previousCompanyId}
            />
        </StrictMode>
    )
}
