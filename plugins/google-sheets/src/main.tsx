import "./globals.css"

import React, { ReactNode, Suspense } from "react"
import ReactDOM from "react-dom/client"
import { framer } from "framer-plugin"
import { ErrorBoundary } from "react-error-boundary"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PluginContext, PluginContextUpdate, getPluginContext, syncSheet } from "./sheets.ts"
import { assert } from "./utils.ts"

import { App } from "./App.tsx"
import { CenteredSpinner } from "./components/CenteredSpinner.tsx"
import { ErrorBoundaryFallback } from "./components/ErrorBoundaryFallback.tsx"

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
})

function shouldSyncImmediately(pluginContext: PluginContext): pluginContext is PluginContextUpdate {
    if (pluginContext.type !== "update") return false
    if (pluginContext.slugFieldColumnIndex === null) return false
    if (pluginContext.hasChangedFields) return false

    return true
}

function renderPlugin(app: ReactNode) {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    // Login page
    framer.showUI({
        width: 320,
        height: 345,
    })

    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <QueryClientProvider client={queryClient}>
                <div className="w-full px-[15px] flex flex-col flex-1 overflow-y-auto no-scrollbar">
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
            assert(pluginContext.slugFieldColumnIndex !== null, "Expected slug field column index")

            const {
                spreadsheetId,
                sheetTitle,
                collectionFields: fields,
                ignoredFieldColumnIndexes,
                slugFieldColumnIndex,
                lastSyncedTime,
                sheet,
            } = pluginContext
            const [headerRow] = sheet.values

            const result = await syncSheet({
                ignoredFieldColumnIndexes,
                slugFieldColumnIndex,
                fetchedSheet: sheet,
                lastSyncedTime,
                spreadsheetId,
                sheetTitle,
                fields,
                // Determine if the field type is already configured, otherwise default to "string"
                colFieldTypes: headerRow.map((_, colIndex) => {
                    const field = fields.find(field => Number(field.id) === colIndex)
                    return field?.type ?? "string"
                }),
            })

            await framer.closePlugin()

            return result
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
