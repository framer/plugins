import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"

import { framer } from "@framerjs/plugin-api"
import "./globals.css"

const root = document.getElementById("root")
if (!root) {
  throw new Error("Root element not found")
}

import.meta.hot?.dispose(() => {
  void framer.closePlugin()
})

void framer.showUI({ title: "Pong", position: "top left", width: 240, height: 220 });

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)