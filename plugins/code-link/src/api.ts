import { normalizeCodeFilePathWithExtension } from "@code-link/shared"
import { framer } from "framer-plugin"
import * as log from "./utils/logger"

/**
 * Plugin API Handlers
 *
 * Tries to be as stateless as possible.
 */

export class CodeFilesAPI {
    private readonly snapshotByPath = new Map<string, string>()

    remember(fileName: string, content: string): void {
        this.setSnapshotContent(fileName, content)
    }

    /** True when inbound content matches what we last recorded for this path (echo / no-op). */
    shouldSkip(fileName: string, content: string): boolean {
        const previous = this.getSnapshotContent(fileName)
        return previous !== undefined && previous === content
    }

    forget(fileName: string): void {
        this.deleteSnapshotEntry(fileName)
    }

    clear(): void {
        this.snapshotByPath.clear()
    }

    getSnapshotContent(fileName: string): string | undefined {
        return this.snapshotByPath.get(normalizeCodeFilePathWithExtension(fileName))
    }

    private setSnapshotContent(fileName: string, content: string): void {
        this.snapshotByPath.set(normalizeCodeFilePathWithExtension(fileName), content)
    }

    private deleteSnapshotEntry(fileName: string): void {
        this.snapshotByPath.delete(normalizeCodeFilePathWithExtension(fileName))
    }

    private getSnapshotPaths(): string[] {
        return [...this.snapshotByPath.keys()]
    }

    private async withExpectedSnapshotPatch<T>(
        patch: {
            upserts?: { fileName: string; content: string }[]
            deletes?: string[]
        },
        run: () => Promise<T>
    ): Promise<T> {
        const previousEntries = new Map<string, string | undefined>()

        for (const fileName of patch.deletes ?? []) {
            const key = normalizeCodeFilePathWithExtension(fileName)
            if (!previousEntries.has(key)) {
                previousEntries.set(key, this.snapshotByPath.get(key))
            }
            this.snapshotByPath.delete(key)
        }

        for (const entry of patch.upserts ?? []) {
            const key = normalizeCodeFilePathWithExtension(entry.fileName)
            if (!previousEntries.has(key)) {
                previousEntries.set(key, this.snapshotByPath.get(key))
            }
            this.snapshotByPath.set(key, entry.content)
        }

        try {
            return await run()
        } catch (error) {
            for (const [fileName, previousContent] of previousEntries) {
                if (previousContent === undefined) {
                    this.snapshotByPath.delete(fileName)
                } else {
                    this.snapshotByPath.set(fileName, previousContent)
                }
            }
            throw error
        }
    }

    private async getCodeFilesWithNormalizedPaths() {
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
                name: normalizeCodeFilePathWithExtension(source),
                content: file.content,
            }
        })
    }

    async publishSnapshot(socket: WebSocket) {
        const files = await this.getCodeFilesWithNormalizedPaths()
        socket.send(JSON.stringify({ type: "file-list", files }))
        this.clear()
        files.forEach(file => {
            this.setSnapshotContent(file.name, file.content)
        })
    }

    async handleFramerFilesChanged(socket: WebSocket) {
        const files = await this.getCodeFilesWithNormalizedPaths()
        const seen = new Set<string>()

        for (const file of files) {
            seen.add(file.name)

            const previous = this.getSnapshotContent(file.name)
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
                this.setSnapshotContent(file.name, file.content)
            }
        }

        for (const fileName of this.getSnapshotPaths()) {
            if (!seen.has(fileName)) {
                socket.send(
                    JSON.stringify({
                        type: "file-delete",
                        fileNames: [fileName],
                    })
                )
                this.deleteSnapshotEntry(fileName)
            }
        }
    }

    async applyRemoteChange(fileName: string, content: string, socket: WebSocket) {
        const normalizedName = normalizeCodeFilePathWithExtension(fileName)
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
        const normalizedName = normalizeCodeFilePathWithExtension(fileName)
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
        const files = await this.getCodeFilesWithNormalizedPaths()
        const normalizedName = normalizeCodeFilePathWithExtension(fileName)
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
                f =>
                    normalizeCodeFilePathWithExtension(f.path || f.name) ===
                    normalizeCodeFilePathWithExtension(request.fileName)
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
        const sourceFileName = normalizeCodeFilePathWithExtension(oldFileName)
        const targetFileName = normalizeCodeFilePathWithExtension(newFileName)

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

        const existing = codeFiles.find(
            file => normalizeCodeFilePathWithExtension(file.path || file.name) === sourceFileName
        )

        if (!existing) {
            this.deleteSnapshotEntry(sourceFileName)
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

        const content = this.getSnapshotContent(sourceFileName) ?? existing.content

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
    const normalisedName = normalizeCodeFilePathWithExtension(fileName)
    const codeFiles = await framer.getCodeFiles()
    const existing = codeFiles.find(
        file => normalizeCodeFilePathWithExtension(file.path || file.name) === normalisedName
    )

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
    const normalisedName = normalizeCodeFilePathWithExtension(fileName)
    const codeFiles = await framer.getCodeFiles()
    const existing = codeFiles.find(
        file => normalizeCodeFilePathWithExtension(file.path || file.name) === normalisedName
    )

    if (existing) {
        await existing.remove()
    }
}
