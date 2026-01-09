import React from "react"
import "framer-plugin/framer.css"
import { $framerInternal, framer } from "framer-plugin"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { MiniRouterProvider } from "./minirouter.tsx"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const collection = await framer.getActiveCollection()
if (collection && collection.managedBy !== "user") {
    framer.closePlugin("CSV Import can only be used on user-editable collections")
}

// This API is unstable and will change without warning, we do not recommend using it until we publish a stable version.
const initialState = framer[$framerInternal.initialState]
const shouldCreate = initialState.action === "collection/import"

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <MiniRouterProvider
            initialRoute={
                shouldCreate
                    ? { uid: "home", opts: { forceCreateCollection: true } }
                    : { uid: "home", opts: { forceCreateCollection: false } }
            }
        >
            <App initialCollection={collection} />
        </MiniRouterProvider>
    </React.StrictMode>
)
