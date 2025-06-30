import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import {
    companyIdPluginKey,
    dataSourceIdPluginKey,
    slugFieldIdPluginKey,
    spaceIdPluginKey,
    syncExistingCollection,
} from "./data"

const lastUsedBoardToken = await framer.getPluginData(spaceIdPluginKey)
const lastUsedCompanyId = await framer.getPluginData(companyIdPluginKey)

const activeCollection = await framer.getActiveManagedCollection()

const previousDataSourceId = await activeCollection.getPluginData(dataSourceIdPluginKey)
const previousSlugFieldId = await activeCollection.getPluginData(slugFieldIdPluginKey)
const previousCollectionBoardToken = await activeCollection.getPluginData(spaceIdPluginKey)
const previousCollectionCompanyId = await activeCollection.getPluginData(companyIdPluginKey)

const previousBoardToken = previousCollectionBoardToken ?? lastUsedBoardToken
const previousCompanyId = previousCollectionCompanyId ?? lastUsedCompanyId

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
                previousBoardToken={previousBoardToken}
                previousCompanyId={previousCompanyId}
            />
        </StrictMode>
    )
}
