import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"

import { App } from "./App.tsx"
import { PLUGIN_KEYS } from "./api"
import auth from "./auth"
import {
    getExistingCollectionDatabaseIdMap,
    type SyncProgress,
    shouldSyncExistingCollection,
    syncExistingCollection,
} from "./data"
import { Authenticate } from "./Login.tsx"
import { Progress } from "./Progress.tsx"
import { showProgressUI } from "./ui"

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
    existingCollectionDatabaseIdMap,
] = await Promise.all([
    activeCollection.getPluginData(PLUGIN_KEYS.DATABASE_ID),
    activeCollection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID),
    activeCollection.getPluginData(PLUGIN_KEYS.LAST_SYNCED),
    activeCollection.getPluginData(PLUGIN_KEYS.IGNORED_FIELD_IDS),
    activeCollection.getPluginData(PLUGIN_KEYS.DATABASE_NAME),
    getExistingCollectionDatabaseIdMap(),
])

const shouldSync = shouldSyncExistingCollection({ previousSlugFieldId, previousDatabaseId })

let didSync = false

if (shouldSync) {
    // Show Progress UI and render Progress component
    await showProgressUI()
    const reactRoot = ReactDOM.createRoot(root)

    const progressState: SyncProgress = { current: 0, total: 0 }
    const setSyncProgress = (progress: SyncProgress) => {
        progressState.current = progress.current
        progressState.total = progress.total
        reactRoot.render(
            <React.StrictMode>
                <Progress current={progressState.current} total={progressState.total} />
            </React.StrictMode>
        )
    }

    // Initial render
    reactRoot.render(
        <React.StrictMode>
            <Progress current={progressState.current} total={progressState.total} />
        </React.StrictMode>
    )

    const { didSync: didSyncResult } = await syncExistingCollection(
        activeCollection,
        previousDatabaseId,
        previousSlugFieldId,
        previousIgnoredFieldIds,
        previousLastSynced,
        previousDatabaseName,
        existingCollectionDatabaseIdMap,
        setSyncProgress
    )

    didSync = didSyncResult
    reactRoot.unmount()
}

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
                existingCollectionDatabaseIdMap={existingCollectionDatabaseIdMap}
            />
        </React.StrictMode>
    )
}
