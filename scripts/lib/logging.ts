const DEBUG = process.env.DEBUG === "1" || process.env.DEBUG === "true"

export const log = {
    info: (msg: string) => {
        console.log(`[INFO] ${msg}`)
    },
    success: (msg: string) => {
        console.log(`[SUCCESS] ${msg}`)
    },
    error: (msg: string) => {
        console.error(`[ERROR] ${msg}`)
    },
    warn: (msg: string) => {
        console.warn(`[WARN] ${msg}`)
    },
    step: (msg: string) => {
        console.log(`\n=== ${msg} ===`)
    },
    debug: (msg: string) => {
        if (!DEBUG) return
        console.log(`[DEBUG] ${msg}`)
    },
}
