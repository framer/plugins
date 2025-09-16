import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const collection = await framer.getActiveCollection()

if (collection && collection.managedBy !== "user") {
    framer.closePlugin("CSV Import can only be used on user-editable collections")
}

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App collection={collection} />
    </React.StrictMode>
)
