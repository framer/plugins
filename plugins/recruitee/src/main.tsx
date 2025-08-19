import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import {
    companyIdPluginKey,
    dataSourceIdPluginKey,
    slugFieldIdPluginKey,
    syncExistingCollection,
    tokenPluginKey,
} from "./data"

const activeCollection = await framer.getActiveManagedCollection()

const [
    lastUsedToken,
    lastUsedCompanyId,
    previousDataSourceId,
    previousSlugFieldId,
    previousCollectionToken,
    previousCollectionCompanyId,
] = await Promise.all([
    framer.getPluginData(tokenPluginKey),
    framer.getPluginData(companyIdPluginKey),
    activeCollection.getPluginData(dataSourceIdPluginKey),
    activeCollection.getPluginData(slugFieldIdPluginKey),
    activeCollection.getPluginData(tokenPluginKey),
    activeCollection.getPluginData(companyIdPluginKey),
])

const previousToken = previousCollectionToken ?? lastUsedToken
const previousCompanyId = previousCollectionCompanyId ?? lastUsedCompanyId

const { didSync } = await syncExistingCollection(
    activeCollection,
    previousDataSourceId,
    previousSlugFieldId,
    previousToken,
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
                previousToken={previousToken}
                previousCompanyId={previousCompanyId}
            />
        </StrictMode>
    )
}
