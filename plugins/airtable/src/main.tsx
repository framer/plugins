import "./globals.css"
import "framer-plugin/framer.css"

import React, { ReactNode } from "react"
import ReactDOM from "react-dom/client"
import { framer } from "framer-plugin"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PluginContext, PluginContextUpdate, getPluginContext, syncTable } from "./airtable"
import { assert } from "./utils.ts"

import { App } from "./App.tsx"
import { PageErrorBoundaryFallback } from "./components/PageErrorBoundaryFallback.tsx"
import { logSyncResult } from "./debug.ts"

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
})

function shouldSyncImmediately(pluginContext: PluginContext): pluginContext is PluginContextUpdate {
    if (pluginContext.type !== "update") return false

    if (!pluginContext.slugFieldId) return false
    if (pluginContext.hasChangedFields) return false

    return true
}

function renderPlugin(app: ReactNode) {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    framer.showUI({
        width: 320,
        height: 345,
    })

    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <QueryClientProvider client={queryClient}>
                <main className="w-full px-[15px] flex flex-col flex-1 overflow-y-auto no-scrollbar">
                    <PageErrorBoundaryFallback>{app}</PageErrorBoundaryFallback>
                </main>
            </QueryClientProvider>
        </React.StrictMode>
    )
}

async function runPlugin() {
    try {
        const pluginContext = await getPluginContext()
        const mode = framer.mode

        if (mode === "syncManagedCollection" && shouldSyncImmediately(pluginContext)) {
            assert(pluginContext.slugFieldId)

            const { baseId, tableId, collectionFields, ignoredFieldIds, slugFieldId, tableSchema, lastSyncedTime } =
                pluginContext

            const result = await syncTable({
                fields: collectionFields,
                ignoredFieldIds,
                lastSyncedTime,
                tableSchema,
                slugFieldId,
                baseId,
                tableId,
            })

            logSyncResult(result)

            await framer.closePlugin()
            return
        }

        renderPlugin(<App pluginContext={pluginContext} />)
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        framer.closePlugin("An unexpected error ocurred: " + message, {
            variant: "error",
        })
    }
}

runPlugin()
