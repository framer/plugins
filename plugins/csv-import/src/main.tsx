import "framer-plugin/framer.css"

import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { framer } from "framer-plugin"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const collection = await framer.getActiveCollection()

if (!collection) {
    framer.closePlugin("Please select a Collection to import into")
    throw new Error()
}

if (collection.readonly) {
    framer.closePlugin("CSV Import can only be used on writable Collections")
    throw new Error()
}

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App collection={collection} />
    </React.StrictMode>
)
