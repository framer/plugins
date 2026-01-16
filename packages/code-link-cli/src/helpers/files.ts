/**
 * File operations helper
 *
 * Single place that understands disk + conflicts. Provides:
 * - listFiles: returns current filesystem state
 * - detectConflicts: compares remote vs local and returns conflicts + safe writes
 * - writeRemoteFiles: applies writes/deletes from remote
 * - deleteLocalFile: removes a file from disk
 *
 * Controller decides WHEN to call these, but never computes conflicts itself.
 */

import { normalizePath, sanitizeFilePath } from "@code-link/shared"
import fs from "fs/promises"
import path from "path"
import type { Conflict, ConflictResolution, ConflictVersionData, FileInfo } from "../types.js"
import type { createHashTracker, HashTracker } from "../utils/hash-tracker.js"
import { debug, warn } from "../utils/logging.js"
import { hashFileContent, type PersistedFileState } from "../utils/state-persistence.js"

const SUPPORTED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json"]
const DEFAULT_EXTENSION = ".tsx"
const DEFAULT_REMOTE_DRIFT_MS = 2000

/** Normalize file name for case-insensitive comparison (macOS/Windows compat) */
function normalizeForComparison(fileName: string): string {
    return fileName.toLowerCase()
}

/**
 * Lists all supported files in the files directory
 */
export async function listFiles(filesDir: string): Promise<FileInfo[]> {
    const files: FileInfo[] = []

    async function walk(currentDir: string): Promise<void> {
        const entries = await fs.readdir(currentDir, { withFileTypes: true })

        for (const entry of entries) {
            const entryPath = path.join(currentDir, entry.name)

            if (entry.isDirectory()) {
                await walk(entryPath)
                continue
            }

            if (!isSupportedExtension(entry.name)) continue

            const relativePath = path.relative(filesDir, entryPath)
            const normalizedPath = normalizePath(relativePath)
            // Don't capitalize when listing existing files - preserve their actual names
            const sanitizedPath = sanitizeFilePath(normalizedPath, false).path

            try {
                const [content, stats] = await Promise.all([fs.readFile(entryPath, "utf-8"), fs.stat(entryPath)])

                files.push({
                    name: sanitizedPath,
                    content,
                    modifiedAt: stats.mtimeMs,
                })
            } catch (err) {
                warn(`Failed to read ${entryPath}:`, err)
            }
        }
    }

    try {
        await walk(filesDir)
    } catch (err) {
        warn("Failed to list files:", err)
    }

    return files
}

/**
 * Detects conflicts between remote files and local filesystem
 * Returns conflicts that need user resolution and safe writes that can be applied
 */
export interface ConflictDetectionOptions {
    preferRemote?: boolean
    detectConflicts?: boolean
    persistedState?: Map<string, PersistedFileState>
}

export async function detectConflicts(
    remoteFiles: FileInfo[],
    filesDir: string,
    options: ConflictDetectionOptions = {}
): Promise<ConflictResolution> {
    const conflicts: Conflict[] = []
    const writes: FileInfo[] = []
    const localOnly: FileInfo[] = []
    const unchanged: FileInfo[] = []
    const detect = options.detectConflicts ?? true
    const preferRemote = options.preferRemote ?? false
    const persistedState = options.persistedState

    const getPersistedState = (fileName: string) =>
        persistedState?.get(normalizeForComparison(fileName)) ?? persistedState?.get(fileName)

    debug(`Detecting conflicts for ${String(remoteFiles.length)} remote files`)

    // Build a snapshot of all local files (keyed by lowercase for case-insensitive matching)
    const localFiles = await listFiles(filesDir)
    const localFileMap = new Map(localFiles.map(f => [normalizeForComparison(f.name), f]))

    // Build a set of remote file names for quick lookup (lowercase keys)
    const remoteFileMap = new Map(
        remoteFiles.map(f => {
            const normalized = resolveRemoteReference(filesDir, f.name)
            return [normalizeForComparison(normalized.relativePath), f]
        })
    )

    // Track which files we've processed (lowercase for case-insensitive matching)
    const processedFiles = new Set<string>()

    // Process remote files (remote-only or both sides)
    for (const remote of remoteFiles) {
        const normalized = resolveRemoteReference(filesDir, remote.name)
        const normalizedKey = normalizeForComparison(normalized.relativePath)
        const local = localFileMap.get(normalizedKey)
        processedFiles.add(normalizedKey)

        const persisted = getPersistedState(normalized.relativePath)
        const localHash = local ? hashFileContent(local.content) : null
        const localMatchesPersisted = !!persisted && !!local && localHash === persisted.contentHash

        if (!local) {
            // File exists in remote but not locally
            if (persisted) {
                // File was previously synced but now missing locally → deleted locally while offline
                // This is a conflict: local=null (deleted), remote=content
                debug(`Conflict: ${normalized.relativePath} deleted locally while offline`)
                conflicts.push({
                    fileName: normalized.relativePath,
                    localContent: null,
                    remoteContent: remote.content,
                    remoteModifiedAt: remote.modifiedAt,
                    lastSyncedAt: persisted.timestamp,
                })
            } else {
                // New file from remote (never synced before): download
                writes.push({
                    name: normalized.relativePath,
                    content: remote.content,
                    modifiedAt: remote.modifiedAt,
                })
            }
            continue
        }

        if (local.content === remote.content) {
            // Content matches - no disk write needed but track for metadata
            unchanged.push({
                name: normalized.relativePath,
                content: remote.content,
                modifiedAt: remote.modifiedAt,
            })
            continue
        }

        if (!detect || preferRemote) {
            writes.push({
                name: normalized.relativePath,
                content: remote.content,
                modifiedAt: remote.modifiedAt,
            })
            continue
        }

        // Check if local file is "clean" (matches last persisted state)
        // If so, we can safely overwrite it with remote changes
        // Both sides have the file with different content -> conflict
        const localClean = persisted ? localMatchesPersisted : undefined
        conflicts.push({
            fileName: normalized.relativePath,
            localContent: local.content,
            remoteContent: remote.content,
            localModifiedAt: local.modifiedAt,
            remoteModifiedAt: remote.modifiedAt,
            lastSyncedAt: persisted?.timestamp,
            localClean,
        })
    }

    // Process local-only files (not present in remote)
    for (const local of localFiles) {
        const localKey = normalizeForComparison(local.name)
        if (!processedFiles.has(localKey)) {
            const persisted = getPersistedState(local.name)
            if (persisted) {
                // File was previously synced but now missing from remote → deleted in Framer
                const localHash = hashFileContent(local.content)
                const localClean = localHash === persisted.contentHash
                debug(`Conflict: ${local.name} deleted in Framer (localClean=${String(localClean)})`)
                conflicts.push({
                    fileName: local.name,
                    localContent: local.content,
                    remoteContent: null,
                    localModifiedAt: local.modifiedAt,
                    lastSyncedAt: persisted.timestamp,
                    localClean,
                })
            } else {
                // New local file (never synced before): upload later
                localOnly.push({
                    name: local.name,
                    content: local.content,
                    modifiedAt: local.modifiedAt,
                })
            }
        }
    }

    // Check for files in persisted state that are missing from BOTH sides
    // These were deleted on both sides while offline - auto-clean them (no conflict)
    if (persistedState) {
        for (const [fileName] of persistedState) {
            const normalizedKey = normalizeForComparison(fileName)
            const inLocal = localFileMap.has(normalizedKey)
            const inRemote = remoteFileMap.has(normalizedKey)
            if (!inLocal && !inRemote) {
                debug(`[AUTO-RESOLVE] ${fileName}: deleted on both sides, no conflict`)
                // No action needed - the file is gone from both sides
                // The persisted state will be cleaned up when we persist
            }
        }
    }

    return { conflicts, writes, localOnly, unchanged }
}

export interface AutoResolveResult {
    autoResolvedLocal: Conflict[]
    autoResolvedRemote: Conflict[]
    remainingConflicts: Conflict[]
}

export function autoResolveConflicts(
    conflicts: Conflict[],
    versions: ConflictVersionData[],
    options: { remoteDriftMs?: number } = {}
): AutoResolveResult {
    const versionMap = new Map(versions.map(version => [version.fileName, version.latestRemoteVersionMs]))
    const remoteDriftMs = options.remoteDriftMs ?? DEFAULT_REMOTE_DRIFT_MS

    const autoResolvedLocal: Conflict[] = []
    const autoResolvedRemote: Conflict[] = []
    const remainingConflicts: Conflict[] = []

    for (const conflict of conflicts) {
        const latestRemoteVersionMs = versionMap.get(conflict.fileName)
        const lastSyncedAt = conflict.lastSyncedAt
        const localClean = conflict.localClean === true

        debug(`Auto-resolve checking ${conflict.fileName}`)

        // Remote deletion: file deleted in Framer
        if (conflict.remoteContent === null) {
            if (localClean) {
                debug(`  Remote deleted, local clean -> REMOTE (delete locally)`)
                autoResolvedRemote.push(conflict)
            } else {
                debug(`  Remote deleted, local modified -> conflict`)
                remainingConflicts.push(conflict)
            }
            continue
        }

        if (!latestRemoteVersionMs) {
            debug(`  No remote version data, keeping conflict`)
            remainingConflicts.push(conflict)
            continue
        }

        if (!lastSyncedAt) {
            debug(`  No last sync timestamp, keeping conflict`)
            remainingConflicts.push(conflict)
            continue
        }

        debug(`  Remote: ${new Date(latestRemoteVersionMs).toISOString()}`)
        debug(`  Synced: ${new Date(lastSyncedAt).toISOString()}`)

        const remoteUnchanged = latestRemoteVersionMs <= lastSyncedAt + remoteDriftMs
        // localClean already declared above for remote deletion handling

        if (remoteUnchanged && !localClean) {
            debug(`  Remote unchanged, local changed -> LOCAL`)
            autoResolvedLocal.push(conflict)
        } else if (localClean && !remoteUnchanged) {
            debug(`  Local unchanged, remote changed -> REMOTE`)
            autoResolvedRemote.push(conflict)
        } else if (remoteUnchanged && localClean) {
            debug(`  Both unchanged, skipping`)
        } else {
            debug(`  Both changed, real conflict`)
            remainingConflicts.push(conflict)
        }
    }

    return {
        autoResolvedLocal,
        autoResolvedRemote,
        remainingConflicts,
    }
}

/**
 * Writes remote files to disk and updates hash tracker to prevent echoes
 * CRITICAL: Update hashTracker BEFORE writing to disk
 */
export async function writeRemoteFiles(
    files: FileInfo[],
    filesDir: string,
    hashTracker: HashTracker,
    installer?: { process: (fileName: string, content: string) => void }
): Promise<void> {
    debug(`Writing ${files.length} remote files`)

    for (const file of files) {
        try {
            const normalized = resolveRemoteReference(filesDir, file.name)
            const fullPath = normalized.absolutePath

            // Ensure directory exists
            await fs.mkdir(path.dirname(fullPath), { recursive: true })

            // CRITICAL ORDER: Update hash tracker FIRST (in memory)
            hashTracker.remember(normalized.relativePath, file.content)

            // THEN write to disk
            await fs.writeFile(fullPath, file.content, "utf-8")

            debug(`Wrote file: ${normalized.relativePath}`)

            // Trigger type installer if available
            installer?.process(normalized.relativePath, file.content)
        } catch (err) {
            warn(`Failed to write file ${file.name}:`, err)
        }
    }
}

/**
 * Deletes a local file from disk
 */
export async function deleteLocalFile(fileName: string, filesDir: string, hashTracker: HashTracker): Promise<void> {
    const normalized = resolveRemoteReference(filesDir, fileName)

    try {
        // CRITICAL ORDER: Mark delete FIRST (in memory) to prevent echo
        hashTracker.markDelete(normalized.relativePath)

        // THEN delete from disk
        await fs.unlink(normalized.absolutePath)

        // Clear the hash immediately
        hashTracker.forget(normalized.relativePath)

        debug(`Deleted file: ${normalized.relativePath}`)
    } catch (err) {
        const nodeError = err as NodeJS.ErrnoException

        if (nodeError.code === "ENOENT") {
            // Treat missing files as already deleted to keep hash tracker in sync
            hashTracker.forget(normalized.relativePath)
            debug(`File already deleted: ${normalized.relativePath}`)
            return
        }

        // Clear pending delete marker immediately on failure
        hashTracker.clearDelete(normalized.relativePath)
        warn(`Failed to delete file ${fileName}:`, err)
    }
}

/**
 * Reads a single file from disk (safe, returns null on error)
 */
export async function readFileSafe(fileName: string, filesDir: string): Promise<string | null> {
    const normalized = resolveRemoteReference(filesDir, fileName)

    try {
        return await fs.readFile(normalized.absolutePath, "utf-8")
    } catch {
        return null
    }
}

/**
 * Filter out files whose content matches the last remembered hash.
 * Used to skip inbound echoes of our own local sends.
 */
export function filterEchoedFiles(files: FileInfo[], hashTracker: ReturnType<typeof createHashTracker>): FileInfo[] {
    return files.filter(file => {
        return !hashTracker.shouldSkip(file.name, file.content)
    })
}

function resolveRemoteReference(filesDir: string, rawName: string) {
    const normalized = sanitizeRelativePath(rawName)
    const absolutePath = path.join(filesDir, normalized.relativePath)
    return { ...normalized, absolutePath }
}

function sanitizeRelativePath(relativePath: string) {
    const trimmed = normalizePath(relativePath.trim())
    const hasExtension = SUPPORTED_EXTENSIONS.some(ext => trimmed.toLowerCase().endsWith(ext))
    const candidate = hasExtension ? trimmed : `${trimmed}${DEFAULT_EXTENSION}`
    // Don't capitalize when processing remote files - preserve exact casing from Framer
    const sanitized = sanitizeFilePath(candidate, false)
    const normalized = normalizePath(sanitized.path)

    return {
        relativePath: normalized,
        extension: sanitized.extension || path.extname(normalized) || DEFAULT_EXTENSION,
    }
}

function isSupportedExtension(fileName: string) {
    const lower = fileName.toLowerCase()
    return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext))
}
