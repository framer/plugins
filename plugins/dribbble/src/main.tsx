import "./globals.css"
import "framer-plugin/framer.css"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React, { Suspense } from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { framer } from "framer-plugin"
import { ErrorBoundary } from "react-error-boundary"
import { CenteredSpinner } from "./components/CenteredSpinner.tsx"
import { ErrorBoundaryFallback } from "./components/ErrorBoundaryFallback.tsx"
import { getPluginContext, shouldSyncImmediately, syncShots } from "./sync.ts"
import { assert } from "./utils.ts"

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
            throwOnError: true,
        },
    },
})

function renderPlugin(app: React.ReactNode) {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <QueryClientProvider client={queryClient}>
                <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                    <Suspense fallback={<CenteredSpinner />}>{app}</Suspense>
                </ErrorBoundary>
            </QueryClientProvider>
        </React.StrictMode>
    )
}

async function runPlugin() {
    const mode = framer.mode

    try {
        const pluginContext = await getPluginContext()

        if (mode === "syncManagedCollection" && shouldSyncImmediately(pluginContext)) {
            assert(pluginContext.slugFieldId)
            return syncShots({
                fields: pluginContext.collectionFields,
                slugFieldId: pluginContext.slugFieldId,
                includedFieldIds: pluginContext.includedFieldIds,
            }).then(() => framer.closePlugin())
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
