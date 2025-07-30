import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import { dataSourceIdPluginKey, jobBoardNamePluginKey, slugFieldIdPluginKey, syncExistingCollection } from "./data.ts"

const lastUsedJobBoardName = await framer.getPluginData(jobBoardNamePluginKey)

const activeCollection = await framer.getActiveManagedCollection()

const [previousDataSourceId, previousSlugFieldId, previousCollectionJobBoardName] = await Promise.all([
    activeCollection.getPluginData(dataSourceIdPluginKey),
    activeCollection.getPluginData(slugFieldIdPluginKey),
    activeCollection.getPluginData(jobBoardNamePluginKey),
])

const previousJobBoardName = previousCollectionJobBoardName ?? lastUsedJobBoardName

const { didSync } = await syncExistingCollection(
    activeCollection,
    previousDataSourceId,
    previousSlugFieldId,
    previousJobBoardName
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
                previousJobBoardName={previousJobBoardName}
            />
        </StrictMode>
    )
}
