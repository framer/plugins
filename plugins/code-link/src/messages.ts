import {
    type CliToPluginMessage,
    type ConflictSummary,
    type Mode,
    normalizeCodeFilePathWithExtension,
    type PendingDelete,
    type SyncTracker,
} from "@code-link/shared"
import type { CodeFilesAPI } from "./api"
import * as log from "./utils/logger"

type MessageHandlerAction =
    | { type: "set-mode"; mode: Mode }
    | { type: "pending-deletes"; files: PendingDelete[] }
    | { type: "conflicts"; conflicts: ConflictSummary[] }

export function createMessageHandler({
    dispatch,
    api,
    syncTracker,
}: {
    dispatch: (action: MessageHandlerAction) => void
    api: CodeFilesAPI
    syncTracker: SyncTracker
}) {
    return async function handleMessage(message: CliToPluginMessage, socket: WebSocket) {
        log.debug("Handling message:", message.type)

        switch (message.type) {
            case "request-files":
                log.debug("Publishing snapshot to CLI")
                await api.publishSnapshot(socket)
                dispatch({
                    type: "set-mode",
                    mode: "syncing",
                })
                break
            case "file-change":
                log.debug("Applying remote change:", message.fileName)
                await api.applyRemoteChange(message.fileName, message.content, socket)
                syncTracker.remember(normalizeCodeFilePathWithExtension(message.fileName), message.content)
                dispatch({ type: "set-mode", mode: "idle" })
                break
            case "file-rename": {
                const { oldFileName, newFileName, content } = message
                log.debug(`Renaming file: ${oldFileName} → ${newFileName}`)
                if (await api.applyRemoteRename(oldFileName, newFileName, socket)) {
                    syncTracker.forget(normalizeCodeFilePathWithExtension(oldFileName))
                    syncTracker.remember(normalizeCodeFilePathWithExtension(newFileName), content)
                }
                dispatch({ type: "set-mode", mode: "idle" })
                break
            }
            case "file-delete":
                if (message.requireConfirmation) {
                    log.debug(`Delete requires confirmation for ${message.fileNames.length} file(s)`)
                    const files: PendingDelete[] = []
                    for (const fileName of message.fileNames) {
                        const content = await api.readCurrentContent(fileName)
                        // Only include files that exist in Framer (have content to restore)
                        if (content !== undefined) {
                            files.push({ fileName, content })
                        }
                    }
                    if (files.length === 0) {
                        // No files exist in Framer, nothing to confirm
                        break
                    }
                    dispatch({
                        type: "pending-deletes",
                        files,
                    })
                } else {
                    for (const fileName of message.fileNames) {
                        log.debug("Deleting file:", fileName)
                        await api.applyRemoteDelete(fileName)
                    }
                }
                break
            case "conflicts-detected":
                log.debug(`Received ${message.conflicts.length} conflicts from CLI`)
                dispatch({ type: "conflicts", conflicts: message.conflicts })
                break
            case "conflict-version-request": {
                log.debug(`Fetching conflict versions for ${message.conflicts.length} files`)
                const versions = await api.fetchConflictVersions(message.conflicts)
                log.debug(`Sending version response for ${versions.length} files`)
                socket.send(
                    JSON.stringify({
                        type: "conflict-version-response",
                        versions,
                    })
                )
                break
            }
            case "sync-complete":
                log.debug("Sync complete, transitioning to idle")
                dispatch({ type: "set-mode", mode: "idle" })
                break
            default:
                log.warn("Unknown message type:", (message as unknown as { type: string }).type)
                break
        }
    }
}
