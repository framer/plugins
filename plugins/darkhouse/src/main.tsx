import "./globals.css"

import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { framer } from "@framerjs/plugin-api"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

import.meta.hot?.dispose(() => {
  void framer.closePlugin()
})

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)