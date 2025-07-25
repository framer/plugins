import "./globals.css"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { framer } from "framer-plugin"
import React from "react"
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

try {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    const pluginContext = await getPluginContext()
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <QueryClientProvider client={queryClient}>
                <div className="w-full px-[15px] flex flex-col flex-1 overflow-y-auto no-scrollbar">
                    <PageErrorBoundaryFallback>
                        <App pluginContext={pluginContext} />
                    </PageErrorBoundaryFallback>
                </div>
            </QueryClientProvider>
        </React.StrictMode>
    )
} catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    void framer.closePlugin(message, { variant: "error" })
}
