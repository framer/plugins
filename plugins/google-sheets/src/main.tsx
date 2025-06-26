import "./globals.css"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { framer } from "framer-plugin"
import React, { type ReactNode } from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { PageErrorBoundaryFallback } from "./components/ErrorBoundaryFallback.tsx"
import { getPluginContext } from "./sheets.ts"

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
            staleTime: 5 * 60 * 1000,
        },
    },
})

function renderPlugin(app: ReactNode) {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <QueryClientProvider client={queryClient}>
                <div className="w-full px-[15px] flex flex-col flex-1 overflow-y-auto no-scrollbar">
                    <PageErrorBoundaryFallback>{app}</PageErrorBoundaryFallback>
                </div>
            </QueryClientProvider>
        </React.StrictMode>
    )
}

async function runPlugin() {
    try {
        const pluginContext = await getPluginContext()

        renderPlugin(<App pluginContext={pluginContext} />)
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e)

        framer.closePlugin(message, {
            variant: "error",
        })
    }
}

runPlugin()
