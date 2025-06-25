import "framer-plugin/framer.css"
import "./reset.css"

import { framer } from "framer-plugin"
import { mount } from "svelte"

import App from "./app.svelte"

// Expose framer on the global scope for testing.
;(window as unknown as Record<string, unknown>).framer = framer

void framer.showUI({
    position: "top right",
    width: 260,
    height: 450,
    minWidth: 260,
    minHeight: 450,
    resizable: true,
})

const app = mount(App, {
    target: document.getElementById("app")!,
})

export default app
