import { framer } from "framer-plugin"

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
        width: 320,
        height: 345,
        minWidth: 320,
        minHeight: 345,
        resizable: false,
    })
}
