import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { assert } from "./api/utils.ts"
import { api } from "./api"
import "./index.css"

const root = document.getElementById("root")
assert(root, "Root element not found")

import.meta.hot?.dispose(() => {
    void api.closePlugin()
})

void api.showWindow({ position: "top left", width: 240, height: 220 })

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
