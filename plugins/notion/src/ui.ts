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

export async function showLoginUI(showDataSourceSelect = false) {
    const height = 345 + (showDataSourceSelect ? 40 : 0)

    await framer.showUI({
        width: 260,
        height,
        minWidth: 260,
        minHeight: height,
        resizable: false,
    })
}

export async function showProgressUI() {
    await framer.showUI({
        width: 260,
        height: 102,
        minWidth: 260,
        minHeight: 102,
        resizable: false,
    })
}
