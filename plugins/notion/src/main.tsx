import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"

import { App } from "./App.tsx"
import { PLUGIN_KEYS } from "./api"
import auth from "./auth"
import { getExistingCollectionDatabaseIdMap, syncExistingCollection } from "./data"
import { Authenticate } from "./Login.tsx"

const activeCollection = await framer.getActiveManagedCollection()

const tokens = auth.getTokens()

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

if (!tokens) {
    const reactRoot = ReactDOM.createRoot(root)

    await new Promise<void>(resolve => {
        reactRoot.render(
            <React.StrictMode>
                <Authenticate onAuthenticated={resolve} />
            </React.StrictMode>
        )
    })

    reactRoot.unmount()
}

const [
    previousDatabaseId,
    previousSlugFieldId,
    previousLastSynced,
    previousIgnoredFieldIds,
    previousDatabaseName,
    previousAltTextMappings,
    existingCollectionDatabaseIdMap,
] = await Promise.all([
    activeCollection.getPluginData(PLUGIN_KEYS.DATABASE_ID),
    activeCollection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID),
    activeCollection.getPluginData(PLUGIN_KEYS.LAST_SYNCED),
    activeCollection.getPluginData(PLUGIN_KEYS.IGNORED_FIELD_IDS),
    activeCollection.getPluginData(PLUGIN_KEYS.DATABASE_NAME),
    activeCollection.getPluginData(PLUGIN_KEYS.ALT_TEXT_MAPPINGS),
    getExistingCollectionDatabaseIdMap(),
])

const { didSync } = await syncExistingCollection(
    activeCollection,
    previousDatabaseId,
    previousSlugFieldId,
    previousIgnoredFieldIds,
    previousLastSynced,
    previousDatabaseName,
    previousAltTextMappings,
    existingCollectionDatabaseIdMap
)

if (didSync) {
    framer.closePlugin("Synchronization successful", {
        variant: "success",
    })
} else {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <App
                collection={activeCollection}
                previousDatabaseId={previousDatabaseId}
                previousSlugFieldId={previousSlugFieldId}
                previousLastSynced={previousLastSynced}
                previousIgnoredFieldIds={previousIgnoredFieldIds}
                previousDatabaseName={previousDatabaseName}
                previousAltTextMappings={previousAltTextMappings}
                existingCollectionDatabaseIdMap={existingCollectionDatabaseIdMap}
            />
        </React.StrictMode>
    )
}
