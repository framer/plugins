import { framer } from "framer-plugin"

export async function showAccessErrorUI() {
    await framer.showUI({
        width: 280,
        height: 114,
        resizable: false,
    })
}

export async function showFieldMappingUI() {
    await framer.showUI({
        width: 425,
        height: 425,
        minWidth: 360,
        minHeight: 425,
        resizable: true,
    })
}

export async function showLoginUI() {
    await framer.showUI({
        width: 260,
        height: 345,
        minWidth: 260,
        minHeight: 345,
        resizable: false,
    })
}
