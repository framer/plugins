import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { api } from "@framerjs/plugin-api"

import "./index.css"

const root = document.getElementById("root")
if (!root) {
    throw new Error("Root element not found")
}

import.meta.hot?.dispose(() => {
    void api.closePlugin()
})

void api.showWindow({ position: "top left", width: 240, height: 450 })

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
