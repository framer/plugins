import "./styles.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./components/App.tsx"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

void framer.showUI({
    width: 760,
    height: 480,
    minWidth: 600,
    minHeight: 360,
    resizable: true,
    position: "center",
})

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
