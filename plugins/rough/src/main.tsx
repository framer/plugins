import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { assert } from "./api/utils.ts"
import "./index.css"

const root = document.getElementById("root")
assert(root, "Root element not found")

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
