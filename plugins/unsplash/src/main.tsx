import "./global.css"
import "framer-plugin/framer.css"

import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

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

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </React.StrictMode>
)
