import "./globals.css"

import React, { ReactNode, Suspense } from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"
import { CenteredSpinner } from "./components/CenteredSpinner"
import { PluginContext, PluginContextUpdate, getPluginContext, synchronizeDatabase } from "./notion"

import { framer } from "framer-plugin"
import { logSyncResult } from "./debug.ts"
import { ErrorBoundaryFallback } from "./components/ErrorBoundaryFallback"
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

function renderPlugin(context: PluginContext, app: ReactNode) {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    framer.showUI({
        width: 350,
        height: context.isAuthenticated ? 370 : 340,
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

        if (mode === "syncCollection" && shouldSyncImmediately(pluginContext)) {
            assert(pluginContext.slugFieldId)

            const result = await synchronizeDatabase(pluginContext.database, {
                fields: pluginContext.collectionFields,
                ignoredFieldIds: pluginContext.ignoredFieldIds,
                lastSyncedTime: pluginContext.lastSyncedTime,
                slugFieldId: pluginContext.slugFieldId,
            })

            logSyncResult(result)

            await framer.closePlugin()
            return
        }

        renderPlugin(pluginContext, <App context={pluginContext} />)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        framer.closePlugin("An unexpected error ocurred: " + message, {
            variant: "error",
        })
    }
}

runPlugin()
