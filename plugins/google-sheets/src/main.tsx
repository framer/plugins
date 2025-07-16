import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { App } from "./App.tsx"
import { PLUGIN_KEYS, syncExistingCollection } from "./data"
import auth from "./auth"
import { Authenticate } from "./Login"

const activeCollection = await framer.getActiveManagedCollection()
const collectionFields = await activeCollection.getFields()

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
            staleTime: 5 * 60 * 1000,
        },
    },
})

const tokens = await auth.getTokens()

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

if (!tokens) {
    const reactRoot = createRoot(root)

    await new Promise<void>(resolve => {
        reactRoot.render(
            <StrictMode>
                <QueryClientProvider client={queryClient}>
                    <Authenticate onAuthenticated={resolve} />
                </QueryClientProvider>
            </StrictMode>
        )
    })

    reactRoot.unmount()
}

const [
    previousSheetId,
    previousSlugFieldId,
    previousSpreadsheetId,
    previousLastSynced,
    previousIgnoredColumns,
    previousSheetHeaderRowHash,
] = await Promise.all([
    activeCollection.getPluginData(PLUGIN_KEYS.SHEET_ID),
    activeCollection.getPluginData(PLUGIN_KEYS.SLUG_COLUMN),
    activeCollection.getPluginData(PLUGIN_KEYS.SPREADSHEET_ID),
    activeCollection.getPluginData(PLUGIN_KEYS.LAST_SYNCED),
    activeCollection.getPluginData(PLUGIN_KEYS.IGNORED_COLUMNS),
    activeCollection.getPluginData(PLUGIN_KEYS.SHEET_HEADER_ROW_HASH),
])

const { didSync } = await syncExistingCollection(
    activeCollection,
    previousSheetId,
    previousSlugFieldId,
    previousSpreadsheetId,
    previousLastSynced,
    previousIgnoredColumns,
    previousSheetHeaderRowHash
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
            <QueryClientProvider client={queryClient}>
                <App
                    collection={activeCollection}
                    collectionFields={collectionFields}
                    previousSheetId={previousSheetId}
                    previousSlugFieldId={previousSlugFieldId}
                    previousSpreadsheetId={previousSpreadsheetId}
                    previousLastSynced={previousLastSynced}
                    previousIgnoredColumns={previousIgnoredColumns}
                    previousSheetHeaderRowHash={previousSheetHeaderRowHash}
                />
            </QueryClientProvider>
        </StrictMode>
    )
}
