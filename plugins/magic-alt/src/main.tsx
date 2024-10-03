import "./globals.css"
import "framer-plugin/framer.css"

import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App"
import { framer } from "framer-plugin"
import { generateCaptions } from "./api"

function renderPlugin() {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")

    framer.showUI({
        position: "top right",
        minWidth: 240,
        minHeight: 300,
        resizable: true,
    })

    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    )
}

async function runPlugin() {
    const mode = framer.mode

    if (mode === "editImage") {
        try {
            const image = await framer.getImage()

            if (!image) {
                await framer.closePlugin("No Image was selected.", { variant: "error" })
                return
            }

            const siteInfo = await framer.getPublishInfo()
            const siteUrl = siteInfo.staging?.url

            if (!siteUrl) {
                await framer.closePlugin("Please publish your site to staging", { variant: "error" })
                return
            }

            const captions = await generateCaptions(siteUrl, [image.url])

            await framer.setImage({
                image: {
                    bytes: (await image.getData()).bytes,
                    mimeType: (await image.getData()).mimeType,
                },
                altText: captions.data[0].caption,
            })

            await framer.closePlugin("Alt text generated", { variant: "success" })
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            framer.closePlugin("An unexpected error occurred: " + message, { variant: "error" })
        }
    }

    renderPlugin()
}

runPlugin()
