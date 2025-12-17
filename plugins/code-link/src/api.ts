import { canonicalFileName, ensureExtension, type SyncTracker, sanitizeFilePath } from "@code-link/shared"
import { CodeFile, framer } from "framer-plugin"
import * as log from "./utils/logger"

// TODO:
// - what is CLI file name vs canonical file name
// - check if the handles can become stale
// - inconsistent error handling of Framer API calls
// - other inline comments below

/**
 * Plugin API Handlers
 *
 * Tries to be as stateless as possible.
 */

export class CodeFilesAPI {
    private lastSnapshot = new Map<string, string>()
    private codeFiles = new Map<string, CodeFile>()

    // @TODO figure out if good idea
    // private async getPossiblyStableCodeFileHandle(name: string) {
    //   const file = this.codeFiles.get(name)
    //   if (file) return file

    //   const allCodeFiles = await framer.getCodeFiles()

    //   this.codeFiles = new Map<string, CodeFile>()

    //   return
    // }

    private async getAllCodeFiles() {
        const codeFiles = await framer.getCodeFiles()

        return Promise.all(
            codeFiles.map(async file => {
                const source = file.path ?? file.name
                return {
                    name: toCliFileName(source),
                    content: file.content,
                }
            })
        )
    }

    async publishSnapshot(socket: WebSocket) {
        const files = await this.getAllCodeFiles()
        socket.send(JSON.stringify({ type: "file-list", files }))
        this.lastSnapshot.clear()
        files.forEach(file => this.lastSnapshot.set(file.name, file.content))
    }

    async handleFramerFilesChanged(socket: WebSocket, tracker: SyncTracker) {
        const files = await this.getAllCodeFiles()
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

        // @TODO: Looping again could be more expensive than diffing.
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
        const cliName = toCliFileName(fileName)
        // Update snapshot BEFORE upsert to prevent race with file subscription
        this.lastSnapshot.set(cliName, content)

        const updatedAt = await upsertFramerFile(fileName, content)
        // Send file-synced message with timestamp
        const syncTimestamp = updatedAt ?? Date.now()
        log.debug(
            `Confirming sync for ${fileName} with timestamp ${new Date(syncTimestamp).toISOString()} (${syncTimestamp})`
        )
        socket.send(
            JSON.stringify({
                type: "file-synced",
                fileName: cliName,
                remoteModifiedAt: syncTimestamp,
            })
        )
    }

    async applyRemoteDelete(fileName: string) {
        await deleteFramerFile(fileName)
        this.lastSnapshot.delete(toCliFileName(fileName))
    }

    async readCurrentContent(fileName: string) {
        // @TODO, again, do we need ALL FILES
        const files = await this.getAllCodeFiles()
        const cliName = toCliFileName(fileName)
        return files.find(file => file.name === cliName)?.content
    }

    async fetchConflictVersions(requests: { fileName: string; lastSyncedAt?: number }[]) {
        log.debug(`Fetching versions for ${requests.length} files`)

        // @TODO why only handle errors here...
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
            // @TODO we do this a lot?
            const file = codeFiles.find(
                f => canonicalFileName(f.path || f.name) === canonicalFileName(request.fileName)
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
                if (versions && versions.length > 0) {
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
        log.debug(`Returning version data for ${results.length} files`)
        return results
    }
}

// @TODO naming is not clear between all path functions, and when to use which.
function toCliFileName(filePath: string) {
    const sanitized = sanitizeFilePath(filePath, false).path
    return ensureExtension(sanitized || canonicalFileName(filePath))
}

async function upsertFramerFile(fileName: string, content: string): Promise<number | undefined> {
    const normalizedTarget = canonicalFileName(fileName)
    // @TODO: investigate if we should keep codeFileHandles around rather than getCodeFiles each time
    const codeFiles = await framer.getCodeFiles()
    const existing = codeFiles.find(file => canonicalFileName(file.path ?? file.name) === canonicalFileName(fileName))

    if (existing) {
        await existing.setFileContent(content)
        return Date.now()
    }

    await framer.createCodeFile(ensureExtension(normalizedTarget), content, {
        editViaPlugin: false,
    })

    return Date.now()
}

async function deleteFramerFile(fileName: string) {
    const normalizedTarget = canonicalFileName(fileName)
    const codeFiles = await framer.getCodeFiles()
    const existing = codeFiles.find(file => canonicalFileName(file.path ?? file.name) === normalizedTarget)

    if (existing) {
        await existing.remove()
    }
}
