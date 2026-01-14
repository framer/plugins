/**
 * Logging utilities for consistent, clean CLI output
 *
 * Features:
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - Message deduplication with count suffix (x2), (x3)
 * - Reconnect cycle suppression (collapses rapid disconnect/reconnect spam)
 * - Clean prefixes (no [INFO] clutter at default level)
 * - Colored startup banner
 */

import pc from "picocolors"

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

let currentLevel = LogLevel.INFO

// Deduplication state
let lastMessage = ""
let lastMessageCount = 0
const CLEAR_LINE = "\u001b[2K"
const MOVE_CURSOR_UP = "\u001b[1A"

// Redraw the previous line with the updated message/count.
function rewriteLastLine(text: string): void {
    if (process.stdout.isTTY) {
        process.stdout.write(`${MOVE_CURSOR_UP}\r${CLEAR_LINE}${text}\n`)
    } else {
        // Fallback for non-TTY (e.g., piping output) – just emit the line.
        process.stdout.write(`${text}\n`)
    }
}

// Reconnect suppression state
let disconnectTimer: ReturnType<typeof setTimeout> | null = null
let isShowingDisconnect = false
let hadRecentDisconnect = false
// Only show disconnect if down for 4+ seconds
// Allows for swtiching between Canvas and Code Editor
const DISCONNECT_DELAY_MS = 4000

export function setLogLevel(level: LogLevel): void {
    currentLevel = level
}

export function getLogLevel(): LogLevel {
    return currentLevel
}

function dedupeMessage(message: string, count: number): void {
    rewriteLastLine(`${message} ${pc.dim(`(x${count})`)}`)
}

/**
 * Flush any pending deduplicated message
 */
function flushDedupe(): void {
    if (lastMessageCount > 1) {
        dedupeMessage(lastMessage, lastMessageCount)
    }
    lastMessage = ""
    lastMessageCount = 0
}

/**
 * Log with deduplication - repeated messages within window get counted
 */
function logWithDedupe(message: string, writer: () => void): void {
    if (message === lastMessage) {
        // Same message - increment count regardless of gap
        lastMessageCount++
        // Overwrite previous line (move cursor up, clear, rewrite)
        dedupeMessage(message, lastMessageCount)
        return
    }

    lastMessage = message
    lastMessageCount = 1
    writer()
}

/**
 * Print the startup banner - one colored line
 */
export function banner(version: string, port: number): void {
    console.log()
    let message = `  ${pc.cyan(pc.bold("⚡ Code Link"))} ${pc.dim(`v${version}`)}`
    if (currentLevel <= LogLevel.DEBUG) {
        message += `  ${pc.dim("Port")} ${pc.yellow(port)}`
    }
    console.log(message)
    console.log()
}

/**
 * Debug-level logging - only shown with --verbose flag
 */
export function debug(message: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.DEBUG) {
        console.debug(pc.dim(`[DEBUG] ${message}`), ...args)
    }
}

/**
 * Info-level logging - shown by default, no prefix
 */
export function info(message: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.INFO) {
        const formatted = args.length > 0 ? `${message} ${args.join(" ")}` : message
        logWithDedupe(formatted, () => {
            console.log(formatted)
        })
    }
}

/**
 * Warning-level logging
 */
export function warn(message: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.WARN) {
        if (message === lastMessage) return // Skip exact duplicates silently
        flushDedupe()
        lastMessage = message
        lastMessageCount = 1
        console.warn(pc.yellow(`⚠ ${message}`), ...args)
    }
}

/**
 * Error-level logging
 */
export function error(message: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.ERROR) {
        flushDedupe()
        console.error(pc.red(`✗ ${message}`), ...args)
    }
}

/**
 * Success message with checkmark
 */
export function success(message: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.INFO) {
        flushDedupe()
        console.log(pc.green(`✓ ${message}`), ...args)
    }
}

/**
 * File sync indicators
 */
export function fileDown(fileName: string): void {
    if (currentLevel <= LogLevel.INFO) {
        const msg = `  ${pc.blue("↓")} ${fileName}`
        logWithDedupe(msg, () => {
            console.log(msg)
        })
    }
}

export function fileUp(fileName: string): void {
    if (currentLevel <= LogLevel.INFO) {
        const msg = `  ${pc.green("↑")} ${fileName}`
        logWithDedupe(msg, () => {
            console.log(msg)
        })
    }
}

export function fileDelete(fileName: string): void {
    if (currentLevel <= LogLevel.INFO) {
        const msg = `  ${pc.red("×")} ${fileName}`
        logWithDedupe(msg, () => {
            console.log(msg)
        })
    }
}

/**
 * Status message (dimmed, for "watching for changes..." etc)
 */
export function status(message: string): void {
    if (currentLevel <= LogLevel.INFO) {
        flushDedupe()
        console.log(pc.dim(`  ${message}`))
    }
}

/**
 * Schedule a delayed disconnect message.
 * If reconnection happens before the delay, the message is cancelled.
 */
export function scheduleDisconnectMessage(callback: () => void): void {
    // Clear any existing timer
    if (disconnectTimer) {
        clearTimeout(disconnectTimer)
    }

    hadRecentDisconnect = true
    isShowingDisconnect = false
    disconnectTimer = setTimeout(() => {
        isShowingDisconnect = true
        callback()
        disconnectTimer = null
    }, DISCONNECT_DELAY_MS)
}

/**
 * Cancel pending disconnect message (called on reconnect)
 */
export function cancelDisconnectMessage(): void {
    if (disconnectTimer) {
        clearTimeout(disconnectTimer)
        disconnectTimer = null
    }
}

/**
 * Check if we showed a disconnect message (need to show reconnect)
 */
export function didShowDisconnect(): boolean {
    return isShowingDisconnect
}

/**
 * Check if we recently saw a disconnect (even if the message was suppressed)
 */
export function wasRecentlyDisconnected(): boolean {
    return hadRecentDisconnect
}

/**
 * Reset disconnect state after successful reconnect
 */
export function resetDisconnectState(): void {
    isShowingDisconnect = false
    hadRecentDisconnect = false
}
