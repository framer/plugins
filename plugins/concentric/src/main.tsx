import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { framer } from "framer-plugin"
import "./globals.css"

const root = document.getElementById("root")
if (!root) {
    throw new Error("Root element not found")
}

import.meta.hot?.dispose(() => {
    void framer.closePlugin()
})

void framer.showUI({
    title: "Concentric",
    position: "top right",
    width: 240,
    height: 100,
})

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
