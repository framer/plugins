// NOTE: framer-plugin/framer.css is intentionally NOT imported. Its generic
// element resets (e.g. `button { width: 100%; justify-content: center }`)
// conflict with this plugin's own design system. Light/dark theming is handled
// by our own tokens in App.css, which key off the `data-framer-theme` attribute
// Framer sets on <body> (plus a prefers-color-scheme fallback) — no framer.css
// needed for that to work.

import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
