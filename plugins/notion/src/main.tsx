import "framer-plugin/framer.css"
import "./globals.css"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React, { type ReactNode, Suspense } from "react"
import ReactDOM from "react-dom/client"
import { ErrorBoundary } from "react-error-boundary"
import { App } from "./App"
import { CenteredSpinner } from "./components/CenteredSpinner"
import { type PluginContext, type PluginContextUpdate, getPluginContext, synchronizeDatabase } from "./notion"

import { framer } from "framer-plugin"
import { ErrorBoundaryFallback } from "./components/ErrorBoundaryFallback"
import { logSyncResult } from "./debug.ts"
import { assert } from "./utils.ts"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
})

function shouldSyncImmediately(pluginContext: PluginContext): pluginContext is PluginContextUpdate {
    if (pluginContext.type !== "update") return false

    if (!pluginContext.database) return false
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
                <div className="px-4 w-full flex flex-col overflow-auto flex-1">
                    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                        <Suspense fallback={<CenteredSpinner />}>{app}</Suspense>
                    </ErrorBoundary>
                </div>
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

            const result = await synchronizeDatabase(pluginContext.database, {
                onProgress: () => {
                    // TODO: Progress indicator.
                },
                fields: pluginContext.collectionFields,
                ignoredFieldIds: pluginContext.ignoredFieldIds,
                lastSyncedTime: pluginContext.lastSyncedTime,
                slugFieldId: pluginContext.slugFieldId,
            })

            logSyncResult(result)

            await framer.closePlugin()
            return
        }

        renderPlugin(<App context={pluginContext} />)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        framer.closePlugin("An unexpected error ocurred: " + message, {
            variant: "error",
        })
    }
}

runPlugin()
