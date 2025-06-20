import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import { dataSourceIdPluginKey, slugFieldIdPluginKey, spaceIdPluginKey, syncExistingCollection } from "./data"

const lastUsedBoardToken = await framer.getPluginData(spaceIdPluginKey)

const activeCollection = await framer.getActiveManagedCollection()

const previousDataSourceId = await activeCollection.getPluginData(dataSourceIdPluginKey)
const previousSlugFieldId = await activeCollection.getPluginData(slugFieldIdPluginKey)
const previousCollectionBoardToken = await activeCollection.getPluginData(spaceIdPluginKey)

const previousBoardToken = previousCollectionBoardToken ?? lastUsedBoardToken

const { didSync } = await syncExistingCollection(
    activeCollection,
    previousDataSourceId,
    previousSlugFieldId,
    previousBoardToken
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
                previousBoardToken={previousBoardToken}
            />
        </StrictMode>
    )
}
