import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"

import { App } from "./App.tsx"
import auth from "./auth"
import { syncExistingCollection } from "./data"
import { PLUGIN_KEYS } from "./api"
import { Authenticate } from "./Login.tsx"
import { syncMethods } from "./utils"

const activeCollection = await framer.getActiveManagedCollection()

const isWorkerAlive = await auth.isWorkerAlive()
if (!isWorkerAlive) {
    framer.closePlugin("OAuth worker is not available, please try again.", {
        variant: "error",
    })
}

const tokens = await auth.getTokens()

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

if (!tokens) {
    await new Promise<void>(resolve => {
        ReactDOM.createRoot(root).render(
            <React.StrictMode>
                <Authenticate onAuthenticated={resolve} />
            </React.StrictMode>
        )
    })
}

const [previousDatabaseId, previousSlugFieldId, previousLastSynced, previousIgnoredFieldIds, previousDatabaseName] =
    await Promise.all([
        activeCollection.getPluginData(PLUGIN_KEYS.DATABASE_ID),
        activeCollection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID),
        activeCollection.getPluginData(PLUGIN_KEYS.LAST_SYNCED),
        activeCollection.getPluginData(PLUGIN_KEYS.IGNORED_FIELD_IDS),
        activeCollection.getPluginData(PLUGIN_KEYS.DATABASE_NAME),
    ])

const isAllowedToSync = framer.isAllowedTo(...syncMethods)

let didSync = false

if (isAllowedToSync) {
    const { didSync: didSyncResult } = await syncExistingCollection(
        activeCollection,
        previousDatabaseId,
        previousSlugFieldId,
        previousIgnoredFieldIds,
        previousLastSynced,
        previousDatabaseName
    )
    didSync = didSyncResult
}

if (didSync) {
    await framer.closePlugin("Synchronization successful", {
        variant: "success",
    })
} else {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <App
                collection={activeCollection}
                previousDataSourceId={previousDatabaseId}
                previousSlugFieldId={previousSlugFieldId}
                previousLastSynced={previousLastSynced}
                previousIgnoredFieldIds={previousIgnoredFieldIds}
                previousDatabaseName={previousDatabaseName}
            />
        </React.StrictMode>
    )
}
