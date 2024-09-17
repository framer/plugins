import { SyncResult } from "./sheets"

export function logSyncResult(result: SyncResult) {
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
