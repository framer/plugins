import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import { dataSourceIdPluginKey, slugFieldIdPluginKey, spaceIdPluginKey, syncExistingCollection } from "./data.ts"

const lastUsedBoardToken = await framer.getPluginData(spaceIdPluginKey)

const activeCollection = await framer.getActiveManagedCollection()

const [previousDataSourceId, previousSlugFieldId, previousCollectionBoardToken] = await Promise.all([
    activeCollection.getPluginData(dataSourceIdPluginKey),
    activeCollection.getPluginData(slugFieldIdPluginKey),
    activeCollection.getPluginData(spaceIdPluginKey),
])

const previousBoardToken = previousCollectionBoardToken ?? lastUsedBoardToken

const { didSync } = await syncExistingCollection(
    activeCollection,
    previousDataSourceId,
    previousSlugFieldId,
    previousBoardToken
)

if (didSync) {
    framer.closePlugin("Synchronization successful", {
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
