import { normalizeCodeFileName, type SyncTracker } from "@code-link/shared"
import { framer } from "framer-plugin"
import * as log from "./utils/logger"

/**
 * Plugin API Handlers
 *
 * Tries to be as stateless as possible.
 */

export class CodeFilesAPI {
    private lastSnapshot = new Map<string, string>()

    // Keep the snapshot aligned with the state Framer should expose, even while a remote mutation is in flight.
    private async withExpectedSnapshotPatch<T>(
        patch: {
            upserts?: { fileName: string; content: string }[]
            deletes?: string[]
        },
        run: () => Promise<T>
    ): Promise<T> {
        const previousEntries = new Map<string, string | undefined>()

        for (const fileName of patch.deletes ?? []) {
            if (!previousEntries.has(fileName)) {
                previousEntries.set(fileName, this.lastSnapshot.get(fileName))
            }
            this.lastSnapshot.delete(fileName)
        }

        for (const entry of patch.upserts ?? []) {
            if (!previousEntries.has(entry.fileName)) {
                previousEntries.set(entry.fileName, this.lastSnapshot.get(entry.fileName))
            }
            this.lastSnapshot.set(entry.fileName, entry.content)
        }

        try {
            return await run()
        } catch (error) {
            for (const [fileName, previousContent] of previousEntries) {
                if (previousContent === undefined) {
                    this.lastSnapshot.delete(fileName)
                } else {
                    this.lastSnapshot.set(fileName, previousContent)
                }
            }
            throw error
        }
    }

    private async getCodeFilesWithCanonicalNames() {
        // Always all files instead of single file calls.
        // The API internally does that anyways.
        // Also ensures everything is fresh.
        let codeFiles
        try {
            codeFiles = await framer.getCodeFiles()
        } catch (err) {
            log.error("Failed to fetch code files", err)
            return []
        }

        return codeFiles.map(file => {
            const source = file.path || file.name
            return {
                name: normalizeCodeFileName(source),
                content: file.content,
            }
        })
    }

    async publishSnapshot(socket: WebSocket) {
        const files = await this.getCodeFilesWithCanonicalNames()
        socket.send(JSON.stringify({ type: "file-list", files }))
        this.lastSnapshot.clear()
        files.forEach(file => this.lastSnapshot.set(file.name, file.content))
    }

    async handleFramerFilesChanged(socket: WebSocket, tracker: SyncTracker) {
        const files = await this.getCodeFilesWithCanonicalNames()
        const seen = new Set<string>()

        for (const file of files) {
            seen.add(file.name)

            const previous = this.lastSnapshot.get(file.name)
            if (previous !== file.content) {
                // Generally only a small number of files change.
                // So we just send each change one by one.
                socket.send(
                    JSON.stringify({
                        type: "file-change",
                        fileName: file.name,
                        content: file.content,
                    })
                )
                tracker.remember(file.name, file.content)
                this.lastSnapshot.set(file.name, file.content)
            }
        }

        for (const fileName of Array.from(this.lastSnapshot.keys())) {
            if (!seen.has(fileName)) {
                socket.send(
                    JSON.stringify({
                        type: "file-delete",
                        fileNames: [fileName],
                        requireConfirmation: false,
                    })
                )
                this.lastSnapshot.delete(fileName)
            }
        }
    }

    async applyRemoteChange(fileName: string, content: string, socket: WebSocket) {
        const normalizedName = normalizeCodeFileName(fileName)
        const updatedAt = await this.withExpectedSnapshotPatch(
            {
                upserts: [{ fileName: normalizedName, content }],
            },
            async () => await upsertFramerFile(normalizedName, content)
        )

        // Send file-synced message with timestamp
        const syncTimestamp = updatedAt ?? Date.now()
        log.debug(
            `Confirming sync for ${fileName} with timestamp ${new Date(syncTimestamp).toISOString()} (${syncTimestamp})`
        )
        socket.send(
            JSON.stringify({
                type: "file-synced",
                fileName: normalizedName,
                remoteModifiedAt: syncTimestamp,
            })
        )
    }

    async applyRemoteDelete(fileName: string) {
        const normalizedName = normalizeCodeFileName(fileName)
        await this.withExpectedSnapshotPatch(
            {
                deletes: [normalizedName],
            },
            async () => {
                await deleteFramerFile(normalizedName)
            }
        )
    }

    async readCurrentContent(fileName: string) {
        const files = await this.getCodeFilesWithCanonicalNames()
        const normalizedName = normalizeCodeFileName(fileName)
        return files.find(file => file.name === normalizedName)?.content
    }

    async fetchConflictVersions(requests: { fileName: string; lastSyncedAt?: number }[]) {
        log.debug(`Fetching versions for ${requests.length} files`)

        let codeFiles
        try {
            codeFiles = await framer.getCodeFiles()
        } catch (err) {
            log.error("Failed to fetch code files", err)
            return requests.map(r => ({
                fileName: r.fileName,
                latestRemoteVersionMs: undefined,
            }))
        }

        const versionPromises = requests.map(async request => {
            const file = codeFiles.find(
                f => normalizeCodeFileName(f.path || f.name) === normalizeCodeFileName(request.fileName)
            )

            if (!file) {
                log.warn(`File ${request.fileName} not found in Framer`)
                return {
                    fileName: request.fileName,
                    latestRemoteVersionMs: undefined,
                }
            }

            try {
                // We need to find the timestamp for the last save to know if we can auto-resolve safetly
                const versions = await file.getVersions()
                if (versions.length > 0 && versions[0]?.createdAt) {
                    const latestRemoteVersionMs = Date.parse(versions[0].createdAt)
                    log.debug(`${request.fileName}: ${versions[0].createdAt} (${latestRemoteVersionMs})`)
                    return {
                        fileName: request.fileName,
                        latestRemoteVersionMs,
                    }
                }
            } catch (err) {
                log.error(`Failed to fetch versions for ${request.fileName}`, err)
            }

            return {
                fileName: request.fileName,
                latestRemoteVersionMs: undefined,
            }
        })

        const results = await Promise.all(versionPromises)
        log.debug(`Returning version data for ${String(results.length)} files`)
        return results
    }

    async applyRemoteRename(oldFileName: string, newFileName: string, socket: WebSocket): Promise<boolean> {
        const sourceFileName = normalizeCodeFileName(oldFileName)
        const targetFileName = normalizeCodeFileName(newFileName)

        let codeFiles
        try {
            codeFiles = await framer.getCodeFiles()
        } catch (err) {
            const message = `Failed to fetch code files for rename ${oldFileName} -> ${newFileName}`
            log.error(message, err)
            socket.send(
                JSON.stringify({
                    type: "error",
                    fileName: targetFileName,
                    message,
                })
            )
            return false
        }

        const existing = codeFiles.find(file => normalizeCodeFileName(file.path || file.name) === sourceFileName)

        if (!existing) {
            this.lastSnapshot.delete(sourceFileName)
            const message = `Rename failed: ${oldFileName} not found in Framer`
            log.warn(message)
            socket.send(
                JSON.stringify({
                    type: "error",
                    fileName: targetFileName,
                    message,
                })
            )
            return false
        }

        const content = this.lastSnapshot.get(sourceFileName) ?? existing.content

        try {
            await this.withExpectedSnapshotPatch(
                {
                    upserts: [{ fileName: targetFileName, content }],
                    deletes: [sourceFileName],
                },
                async () => await existing.rename(targetFileName)
            )
            socket.send(
                JSON.stringify({
                    type: "file-synced",
                    fileName: targetFileName,
                    remoteModifiedAt: Date.now(),
                })
            )
            return true
        } catch (err) {
            const message = `Failed to rename ${oldFileName} -> ${newFileName}`
            log.error(message, err)
            socket.send(
                JSON.stringify({
                    type: "error",
                    fileName: targetFileName,
                    message,
                })
            )
            return false
        }
    }
}

async function upsertFramerFile(fileName: string, content: string): Promise<number | undefined> {
    const normalisedName = normalizeCodeFileName(fileName)
    const codeFiles = await framer.getCodeFiles()
    const existing = codeFiles.find(file => normalizeCodeFileName(file.path || file.name) === normalisedName)

    if (existing) {
        await existing.setFileContent(content)
        return Date.now()
    }

    await framer.createCodeFile(normalisedName, content, {
        editViaPlugin: false,
    })

    return Date.now()
}

async function deleteFramerFile(fileName: string) {
    const normalisedName = normalizeCodeFileName(fileName)
    const codeFiles = await framer.getCodeFiles()
    const existing = codeFiles.find(file => normalizeCodeFileName(file.path || file.name) === normalisedName)

    if (existing) {
        await existing.remove()
    }
}
