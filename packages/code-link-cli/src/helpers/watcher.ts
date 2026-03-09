/**
 * File watcher helper
 *
 * Wrapper around chokidar that normalizes file paths and filters to ts, tsx, js, json.
 */

import { isSupportedExtension, normalizePath, sanitizeFilePath } from "@code-link/shared"
import chokidar from "chokidar"
import fs from "fs/promises"
import path from "path"
import type { WatcherEvent } from "../types.ts"
import { debug, warn } from "../utils/logging.ts"
import { getRelativePath } from "../utils/node-paths.ts"
import { hashFileContent } from "../utils/state-persistence.ts"

export interface Watcher {
    on(event: "change", handler: (event: WatcherEvent) => void): void
    close(): Promise<void>
}

const RENAME_BUFFER_MS = 100

interface PendingDelete {
    relativePath: string
    contentHash: string
    timer: ReturnType<typeof setTimeout>
}

interface PendingAdd {
    relativePath: string
    contentHash: string
    content: string
    timer: ReturnType<typeof setTimeout>
    previousContentHash?: string
}

function findUniqueHashMatch<T extends { contentHash: string }>(
    pendingItems: Map<string, T>,
    contentHash: string
): string | undefined {
    let matchingKey: string | undefined

    for (const [key, pending] of pendingItems) {
        if (pending.contentHash !== contentHash) {
            continue
        }

        if (matchingKey !== undefined) {
            return undefined
        }

        matchingKey = key
    }

    return matchingKey
}

/**
 * Initializes a file watcher for the given directory
 */
export function initWatcher(filesDir: string): Watcher {
    const handlers: ((event: WatcherEvent) => void)[] = []

    // Content hash cache: tracks last-known hash for rename detection
    const contentHashCache = new Map<string, string>()

    // Pending deletes/adds awaiting potential rename matching (keyed by relativePath)
    const pendingDeletes = new Map<string, PendingDelete>()
    const pendingAdds = new Map<string, PendingAdd>()

    // Paths recently renamed by sanitization — used to suppress echo events from chokidar
    const recentSanitizations = new Set<string>()

    const watcher = chokidar.watch(filesDir, {
        ignored: /(^|[/\\])\.\./, // ignore dotfiles
        persistent: true,
        ignoreInitial: false, // Emit add events for existing files so we can sanitize them
    })

    debug(`Watching directory: ${filesDir}`)

    const dispatchEvent = (event: WatcherEvent): void => {
        let eventToDispatch = event

        if (event.kind === "rename" && event.relativePath === event.oldRelativePath) {
            if (event.content === undefined) {
                warn(`Skipping invalid same-path rename without content: ${event.relativePath}`)
                return
            }

            debug(`Converting same-path rename to change: ${event.relativePath}`)
            eventToDispatch = {
                kind: "change",
                relativePath: event.relativePath,
                content: event.content,
            }
        }

        debug(`Watcher event: ${eventToDispatch.kind} ${eventToDispatch.relativePath}`)
        for (const handler of handlers) {
            handler(eventToDispatch)
        }
    }

    /**
     * Resolves the sanitized relative path for a given absolute path.
     * On "add", renames files on disk if they don't match sanitization rules.
     */
    const resolveRelativePath = async (
        kind: "add" | "change" | "delete",
        absolutePath: string
    ): Promise<{ relativePath: string; effectiveAbsolutePath: string } | null> => {
        if (!isSupportedExtension(absolutePath)) {
            return null
        }

        const rawRelativePath = normalizePath(getRelativePath(filesDir, absolutePath))
        const sanitized = sanitizeFilePath(rawRelativePath, false)
        const relativePath = sanitized.path

        let effectiveAbsolutePath = absolutePath
        if (relativePath !== rawRelativePath && kind === "add") {
            const newAbsolutePath = path.join(filesDir, relativePath)
            try {
                await fs.mkdir(path.dirname(newAbsolutePath), { recursive: true })
                await fs.rename(absolutePath, newAbsolutePath)
                debug(`Renamed ${rawRelativePath} -> ${relativePath}`)
                effectiveAbsolutePath = newAbsolutePath

                // Suppress the echo events chokidar will fire for this rename
                recentSanitizations.add(rawRelativePath) // upcoming unlink echo
                recentSanitizations.add(relativePath) // upcoming add echo
                setTimeout(() => {
                    recentSanitizations.delete(rawRelativePath)
                    recentSanitizations.delete(relativePath)
                }, RENAME_BUFFER_MS * 3)
            } catch (err) {
                warn(`Failed to rename ${rawRelativePath}`, err)
                return { relativePath: rawRelativePath, effectiveAbsolutePath: absolutePath }
            }
        }

        return { relativePath, effectiveAbsolutePath }
    }

    // Helper to emit normalized events
    const emitEvent = async (kind: "add" | "change" | "delete", absolutePath: string): Promise<void> => {
        // Suppress echo events caused by sanitization renames
        const rawRelPath = normalizePath(getRelativePath(filesDir, absolutePath))
        if (recentSanitizations.delete(rawRelPath)) {
            debug(`Suppressing sanitization echo: ${kind} ${rawRelPath}`)
            return
        }

        const resolved = await resolveRelativePath(kind, absolutePath)
        if (!resolved) return
        const { relativePath, effectiveAbsolutePath } = resolved

        if (kind === "delete") {
            const lastHash = contentHashCache.get(relativePath)
            contentHashCache.delete(relativePath)

            const samePathPendingAdd = pendingAdds.get(relativePath)
            if (samePathPendingAdd) {
                clearTimeout(samePathPendingAdd.timer)
                pendingAdds.delete(relativePath)

                try {
                    const latestContent = await fs.readFile(effectiveAbsolutePath, "utf-8")
                    const latestHash = hashFileContent(latestContent)
                    contentHashCache.set(relativePath, latestHash)
                    dispatchEvent({ kind: "change", relativePath, content: latestContent })
                } catch {
                    if (samePathPendingAdd.previousContentHash !== undefined) {
                        dispatchEvent({ kind: "delete", relativePath })
                    } else {
                        debug(`Suppressing transient add+delete: ${relativePath}`)
                    }
                }
                return
            }

            if (lastHash) {
                // Only emit rename when there is a single unambiguous add candidate.
                const matchingAddKey = findUniqueHashMatch(pendingAdds, lastHash)

                if (matchingAddKey) {
                    const matchingAdd = pendingAdds.get(matchingAddKey)
                    if (!matchingAdd) {
                        return
                    }
                    clearTimeout(matchingAdd.timer)
                    pendingAdds.delete(matchingAddKey)

                    // Emit as a single rename event
                    dispatchEvent({
                        kind: "rename",
                        relativePath: matchingAdd.relativePath,
                        oldRelativePath: relativePath,
                        content: matchingAdd.content,
                    })
                    return
                }

                // No pending add match — buffer this delete
                const timer = setTimeout(() => {
                    pendingDeletes.delete(relativePath)
                    dispatchEvent({ kind: "delete", relativePath })
                }, RENAME_BUFFER_MS)

                pendingDeletes.set(relativePath, { relativePath, contentHash: lastHash, timer })
            } else {
                // No cached hash — emit delete immediately
                dispatchEvent({ kind: "delete", relativePath })
            }
            return
        }

        // For add/change, read file content
        let content: string
        try {
            content = await fs.readFile(effectiveAbsolutePath, "utf-8")
        } catch (err) {
            debug(`Failed to read file ${relativePath}:`, err)
            return
        }

        const previousContentHash = contentHashCache.get(relativePath)

        // Update content hash cache
        const contentHash = hashFileContent(content)
        contentHashCache.set(relativePath, contentHash)

        if (kind === "add") {
            const samePathPendingDelete = pendingDeletes.get(relativePath)
            if (samePathPendingDelete) {
                clearTimeout(samePathPendingDelete.timer)
                pendingDeletes.delete(relativePath)
                dispatchEvent({ kind: "change", relativePath, content })
                return
            }

            // Only emit rename when there is a single unambiguous delete candidate.
            const matchingDeleteKey = findUniqueHashMatch(pendingDeletes, contentHash)

            if (matchingDeleteKey) {
                const matchingDelete = pendingDeletes.get(matchingDeleteKey)
                if (!matchingDelete) {
                    return
                }
                clearTimeout(matchingDelete.timer)
                pendingDeletes.delete(matchingDeleteKey)

                // Emit as a single rename event
                dispatchEvent({
                    kind: "rename",
                    relativePath,
                    oldRelativePath: matchingDelete.relativePath,
                    content,
                })
                return
            }

            // No pending delete match — buffer this add in case a delete arrives soon
            const timer = setTimeout(() => {
                pendingAdds.delete(relativePath)
                dispatchEvent({ kind: "add", relativePath, content })
            }, RENAME_BUFFER_MS)

            pendingAdds.set(relativePath, {
                relativePath,
                contentHash,
                content,
                timer,
                previousContentHash,
            })
            return
        }

        // If this file has a buffered add, cancel it and dispatch as "add" with fresh content
        const pendingAdd = pendingAdds.get(relativePath)
        if (pendingAdd) {
            clearTimeout(pendingAdd.timer)
            pendingAdds.delete(relativePath)
            dispatchEvent({ kind: "add", relativePath, content })
            return
        }

        dispatchEvent({ kind, relativePath, content })
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
            for (const pending of pendingDeletes.values()) {
                clearTimeout(pending.timer)
            }
            for (const pending of pendingAdds.values()) {
                clearTimeout(pending.timer)
            }
            pendingDeletes.clear()
            pendingAdds.clear()
            contentHashCache.clear()
            recentSanitizations.clear()
            await watcher.close()
        },
    }
}
