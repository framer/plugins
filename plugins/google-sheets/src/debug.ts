import { SyncResult } from "./sheets"

export const PLUGIN_LOG_SYNC_KEY = "sheetsLogSyncResult"

const isLoggingEnabled = () => {
    return localStorage.getItem(PLUGIN_LOG_SYNC_KEY) === "true"
}

export function logSyncResult(result: SyncResult, collectionItems?: Record<string, unknown>[]) {
    if (!isLoggingEnabled()) return

    if (collectionItems) {
        console.table(collectionItems)
    }

    if (result.errors.length > 0) {
        console.log("Completed errors:")
        console.table(result.errors)
    }

    if (result.warnings.length > 0) {
        console.log("Completed warnings:")
        console.table(result.warnings)
    }

    console.log("Completed info:")
    console.table(result.info)
}
