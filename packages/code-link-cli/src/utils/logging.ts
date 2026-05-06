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

export const LogLevel = {
    DEBUG: "debug",
    INFO: "info",
    WARN: "warn",
    ERROR: "error",
} as const

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]
export type LogEntryLevel = "info" | "debug" | "warn" | "success" | "status"

const LOG_PRIORITY: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
}

let currentLevel: LogLevel = LogLevel.INFO

function allows(level: LogLevel): boolean {
    return LOG_PRIORITY[currentLevel] <= LOG_PRIORITY[level]
}

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
    if (allows(LogLevel.DEBUG)) {
        message += `  ${pc.dim("Port")} ${pc.yellow(port)}`
    }
    console.log(message)
    console.log()
}

/**
 * Debug-level logging - only shown with --verbose flag
 */
export function debug(message: string, ...args: unknown[]): void {
    if (allows(LogLevel.DEBUG)) {
        console.debug(pc.dim(`[DEBUG] ${message}`), ...args)
    }
}

/**
 * Info-level logging - shown by default, no prefix
 */
export function info(message: string, ...args: unknown[]): void {
    if (allows(LogLevel.INFO)) {
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
    if (allows(LogLevel.WARN)) {
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
    if (allows(LogLevel.ERROR)) {
        flushDedupe()
        console.error(pc.red(`✗ ${message}`), ...args)
    }
}

/**
 * Success message with checkmark
 */
export function success(message: string, ...args: unknown[]): void {
    if (allows(LogLevel.INFO)) {
        flushDedupe()
        console.log(pc.green(`✓ ${message}`), ...args)
    }
}

/**
 * File sync indicators
 */
export function fileDown(fileName: string): void {
    if (allows(LogLevel.INFO)) {
        const msg = `  ${pc.blue("↓")} ${fileName}`
        logWithDedupe(msg, () => {
            console.log(msg)
        })
    }
}

export function fileUp(fileName: string): void {
    if (allows(LogLevel.INFO)) {
        const msg = `  ${pc.green("↑")} ${fileName}`
        logWithDedupe(msg, () => {
            console.log(msg)
        })
    }
}

export function fileDelete(fileName: string): void {
    if (allows(LogLevel.INFO)) {
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
    if (allows(LogLevel.INFO)) {
        flushDedupe()
        console.log(pc.dim(`  ${message}`))
    }
}
