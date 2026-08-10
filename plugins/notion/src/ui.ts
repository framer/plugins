import { framer } from "framer-plugin"
import type { SyncResult } from "./data"

type SyncResultWithErrors = Extract<SyncResult, { status: "completed-with-errors" }>

export function closePluginAfterSyncWithErrors(result: SyncResultWithErrors) {
    const pluralSuffix = result.failed === 1 ? "" : "s"
    framer.closePlugin(`Failed to sync ${result.failed} item${pluralSuffix}. Please try again.`, {
        variant: "error",
    })
}

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

export async function showProgressUI() {
    await framer.showUI({
        width: 260,
        height: 102,
        minWidth: 260,
        minHeight: 102,
        resizable: false,
    })
}
