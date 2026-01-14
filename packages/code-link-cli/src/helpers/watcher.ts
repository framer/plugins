/**
 * File watcher helper
 *
 * Wrapper around chokidar that normalizes file paths and filters to ts, tsx, js, json.
 */

import { isSupportedExtension, normalizePath, sanitizeFilePath } from "@code-link/shared"
import chokidar from "chokidar"
import fs from "fs/promises"
import path from "path"
import type { WatcherEvent } from "../types.js"
import { debug, warn } from "../utils/logging.js"
import { getRelativePath } from "../utils/node-paths.js"

export interface Watcher {
    on(event: "change", handler: (event: WatcherEvent) => void): void
    close(): Promise<void>
}

/**
 * Initializes a file watcher for the given directory
 */
export function initWatcher(filesDir: string): Watcher {
    const handlers: ((event: WatcherEvent) => void)[] = []

    const watcher = chokidar.watch(filesDir, {
        ignored: /(^|[/\\])\.\./, // ignore dotfiles
        persistent: true,
        ignoreInitial: false, // Emit add events for existing files so we can sanitize them
    })

    debug(`Watching directory: ${filesDir}`)

    // Helper to emit normalized events
    const emitEvent = async (kind: "add" | "change" | "delete", absolutePath: string): Promise<void> => {
        if (!isSupportedExtension(absolutePath)) {
            return
        }

        const rawRelativePath = normalizePath(getRelativePath(filesDir, absolutePath))
        // Don't capitalize - preserve exact file names as they exist
        // This ensures 1:1 sync with Framer without modifying user's casing choices
        const sanitized = sanitizeFilePath(rawRelativePath, false)
        const relativePath = sanitized.path

        // If the user created a file that doesn't match our sanitization rules,
        // rename it on disk to match what can be synced.
        let effectiveAbsolutePath = absolutePath
        if (relativePath !== rawRelativePath && kind === "add") {
            const newAbsolutePath = path.join(filesDir, relativePath)
            try {
                await fs.mkdir(path.dirname(newAbsolutePath), { recursive: true })
                await fs.rename(absolutePath, newAbsolutePath)
                debug(`Renamed ${rawRelativePath} -> ${relativePath}`)
                effectiveAbsolutePath = newAbsolutePath
            } catch (err) {
                warn(`Failed to rename ${rawRelativePath}`, err)
            }
        }

        let content: string | undefined
        if (kind !== "delete") {
            try {
                content = await fs.readFile(effectiveAbsolutePath, "utf-8")
            } catch (err) {
                debug(`Failed to read file ${relativePath}:`, err)
                return
            }
        }

        const event: WatcherEvent = {
            kind,
            relativePath,
            content,
        }

        debug(`Watcher event: ${kind} ${relativePath}`)

        for (const handler of handlers) {
            handler(event)
        }
    }

    watcher.on("add", filePath => {
        void emitEvent("add", filePath)
    })
    watcher.on("change", filePath => {
        void emitEvent("change", filePath)
    })
    watcher.on("unlink", filePath => {
        void emitEvent("delete", filePath)
    })

    return {
        on(_event: "change", handler: (event: WatcherEvent) => void): void {
            handlers.push(handler)
        },

        async close(): Promise<void> {
            await watcher.close()
        },
    }
}
