import "framer-plugin/framer.css"
import "./App.css"

import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { LogLevel, setLogLevel } from "./utils/logger"

// Auto-enable debug logs while running in Vite dev.
const logLevel = import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.INFO
setLogLevel(logLevel)
console.info(
    `[INFO] Log level ${LogLevel[logLevel]} ${import.meta.env.DEV ? "because in dev mode" : "because default mode"}`
)

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
