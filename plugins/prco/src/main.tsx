import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import { dataSourceIdPluginKey, pressRoomIdPluginKey, slugFieldIdPluginKey, syncExistingCollection } from "./data"

const activeCollection = await framer.getActiveManagedCollection()

const [lastUsedPressRoomId, previousDataSourceId, previousSlugFieldId, previousCollectionPressRoomId] =
    await Promise.all([
        framer.getPluginData(pressRoomIdPluginKey),
        activeCollection.getPluginData(dataSourceIdPluginKey),
        activeCollection.getPluginData(slugFieldIdPluginKey),
        activeCollection.getPluginData(pressRoomIdPluginKey),
    ])

const previousPressRoomId = previousCollectionPressRoomId ?? lastUsedPressRoomId

const { didSync } = await syncExistingCollection(
    activeCollection,
    previousDataSourceId,
    previousSlugFieldId,
    previousPressRoomId
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
                previousPressRoomId={previousPressRoomId}
            />
        </StrictMode>
    )
}
