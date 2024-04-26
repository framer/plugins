import "./globals.css"

import React, { Suspense } from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { QueryErrorResetBoundary, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"
import { CenteredSpinner } from "./components/CenteredSpinner.tsx"
import { getPluginConfig } from "./notion.ts"

import { framer } from "framer-plugin"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
})

function ErrorBoundaryFallback() {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => {
                return (
                    <div className="flex flex-col w-full h-full gap-2 items-center justify-center">
                        <span>Something went wrong...</span>
                        <button onClick={reset}>Try again</button>
                    </div>
                )
            }}
        </QueryErrorResetBoundary>
    )
}

async function renderApp() {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    const mode = await framer.getMode()
    if (mode === "default") {
        // TODO: Dont allow launching here
        framer.closePlugin("This Plugin can only be started from CMS ")
        return
    }

    try {
        const pluginConfig = await getPluginConfig()

        framer.showUI({
            width: 350,
            height: 385,
        })

        ReactDOM.createRoot(root).render(
            <React.StrictMode>
                <QueryClientProvider client={queryClient}>
                    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                        <div className="h-[1px] border-b border-divider mx-4" />
                        <div className="px-4 pt-4 w-full flex flex-col overflow-auto flex-1">
                            <Suspense fallback={<CenteredSpinner />}>
                                <App config={pluginConfig} />
                            </Suspense>
                        </div>
                    </ErrorBoundary>
                </QueryClientProvider>
            </React.StrictMode>
        )
    } catch (error) {
        console.error("Plugin error:", error)
        framer.closePlugin("Something went wrong during initialization")
    }
}

renderApp()
