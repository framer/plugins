import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const activeLocale = await framer.getActiveLocale()
const locales = await framer.getLocales()

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App activeLocale={activeLocale} locales={locales} />
    </React.StrictMode>
)
