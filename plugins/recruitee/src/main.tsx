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

const activeCollection = await framer.getActiveManagedCollection()

const [
    lastUsedBoardToken,
    lastUsedCompanyId,
    previousDataSourceId,
    previousSlugFieldId,
    previousCollectionBoardToken,
    previousCollectionCompanyId,
] = await Promise.all([
    framer.getPluginData(spaceIdPluginKey),
    framer.getPluginData(companyIdPluginKey),
    activeCollection.getPluginData(dataSourceIdPluginKey),
    activeCollection.getPluginData(slugFieldIdPluginKey),
    activeCollection.getPluginData(spaceIdPluginKey),
    activeCollection.getPluginData(companyIdPluginKey),
])

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
    void framer.closePlugin("Synchronization successful", {
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
