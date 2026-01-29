import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const [activeLocale, locales] = await Promise.all([framer.getActiveLocale(), framer.getLocales()])

if (window.location.hostname === "localhost") {
    console.log({ activeLocale, locales })
}

if (!activeLocale) {
    framer.closePlugin(
        locales.length > 0
            ? "No active locale found. Please select a locale."
            : "No locales found. Please create a locale.",
        { variant: "error" }
    )
} else {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <App activeLocale={activeLocale} locales={locales} />
        </React.StrictMode>
    )
}
