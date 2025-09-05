import "framer-plugin/framer.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const collection = await framer.getActiveCollection()

if (collection && collection.readonly) {
    await framer.closePlugin("CSV Import can only be used on writable Collections")
    throw new Error("Unreachable")
}

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App collection={collection} />
    </React.StrictMode>
)
