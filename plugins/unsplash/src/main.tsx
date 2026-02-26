import "./global.css"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"
import { registerAgentTools } from "./agentTools/registerAgentTools"
import { App } from "./App.tsx"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
            throwOnError: true,
        },
    },
})

if (framer.mode === "api") {
    registerAgentTools()
} else {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
        </React.StrictMode>
    )
}
