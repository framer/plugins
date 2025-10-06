import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const activeLocale = await framer.getActiveLocale()
const locales = await framer.getLocales()

const isAllowedToSetLocalizationData = framer.isAllowedTo("setLocalizationData")

if (!isAllowedToSetLocalizationData) {
    framer.notify("You are not allowed to set localization data", { variant: "error" })
    framer.closePlugin()
} else if (!activeLocale) {
    framer.notify("No active locale found", { variant: "error" })
    framer.closePlugin()
} else {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <App activeLocale={activeLocale} locales={locales} />
        </React.StrictMode>
    )
}
