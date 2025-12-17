import "framer-plugin/framer.css"
import "./App.css"

import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { setLogLevel, LogLevel } from "./utils/logger"

// Enable debug logging in development
if (import.meta.env.DEV) {
  setLogLevel(LogLevel.DEBUG)
}

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
