import { framer } from "framer-plugin"

export async function showNoTableAccessUI() {
    await framer.showUI({
        width: 240,
        height: 110,
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

export async function showDataSourceSelectionUI() {
    await framer.showUI({
        width: 320,
        height: 345,
        resizable: false,
    })
}

export async function showLoginUI() {
    await framer.showUI({
        width: 320,
        height: 340,
        resizable: false,
    })
}
