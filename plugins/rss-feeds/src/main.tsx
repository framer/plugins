import "./globals.css"

import { framer } from "framer-plugin"
import React from "react"
import ReactDOM from "react-dom/client"
import { App, importData } from "./App.tsx"

async function runPlugin() {
  const mode = framer.mode
  const collection = await framer.getCollection()

  const rssSourceId = await collection.getPluginData("rssSourceId")
  if (mode === "syncCollection" && rssSourceId) {
    try {
      await importData(collection, rssSourceId)
      await framer.closePlugin()
    } catch {
      // Failed to synchronize - show configuration
    }
  }

  const root = document.getElementById("root")
  if (!root) {
    throw new Error("Root element not found")
  }

  framer.showUI({
    position: "top right",
    width: 280,
    height: 305,
  })

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App collection={collection} initialRssSourceId={rssSourceId} />
    </React.StrictMode>
  )
}

runPlugin()
