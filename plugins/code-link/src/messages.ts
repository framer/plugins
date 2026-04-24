import {
    type CliToPluginMessage,
    type ConflictSummary,
    normalizeCodeFilePathWithExtension,
    type PendingDelete,
    type PromptSession,
    type SyncPhase,
} from "@code-link/shared"
import type { CodeFilesAPI } from "./api"
import * as log from "./utils/logger"

type MessageHandlerAction =
    | { type: "sync-phase"; syncPhase: SyncPhase }
    | { type: "pending-deletes"; files: PendingDelete[]; session: PromptSession; source: "initial" | "runtime" }
    | { type: "clear-pending-deletes"; session: PromptSession; fileNames?: string[] }
    | { type: "conflicts"; conflicts: ConflictSummary[]; session: PromptSession }
    | { type: "clear-conflicts"; session: PromptSession }

export function createMessageHandler({
    dispatch,
    api,
}: {
    dispatch: (action: MessageHandlerAction) => void
    api: CodeFilesAPI
}) {
    return async function handleMessage(message: CliToPluginMessage, socket: WebSocket) {
        log.debug("Handling message:", message.type)

        switch (message.type) {
            case "request-files":
                log.debug("Publishing snapshot to CLI")
                await api.publishSnapshot(socket)
                break
            case "sync-phase":
                dispatch({ type: "sync-phase", syncPhase: message.phase })
                break
            case "file-change":
                log.debug("Applying remote change:", message.fileName)
                await api.applyRemoteChange(message.fileName, message.content, socket)
                api.remember(normalizeCodeFilePathWithExtension(message.fileName), message.content)
                break
            case "file-rename": {
                const { oldFileName, newFileName, content } = message
                log.debug(`Renaming file: ${oldFileName} → ${newFileName}`)
                if (await api.applyRemoteRename(oldFileName, newFileName, socket)) {
                    api.forget(normalizeCodeFilePathWithExtension(oldFileName))
                    api.remember(normalizeCodeFilePathWithExtension(newFileName), content)
                }
                break
            }
            case "file-delete":
                if (message.requireConfirmation) {
                    log.debug(`Delete requires confirmation for ${message.fileNames.length} file(s)`)
                    const files: PendingDelete[] = []
                    const missingFileNames: string[] = []
                    for (const fileName of message.fileNames) {
                        const content = await api.readCurrentContent(fileName)
                        // Only include files that exist in Framer (have content to restore)
                        if (content !== undefined) {
                            files.push({ fileName, content })
                        } else {
                            missingFileNames.push(fileName)
                        }
                    }
                    if (missingFileNames.length > 0) {
                        socket.send(
                            JSON.stringify({
                                type: "delete-confirmed",
                                fileNames: missingFileNames,
                                session: message.session,
                            })
                        )
                    }
                    if (files.length === 0) {
                        // No files exist in Framer, nothing to confirm
                        break
                    }
                    dispatch({
                        type: "pending-deletes",
                        files,
                        session: message.session,
                        source: "runtime",
                    })
                } else {
                    for (const fileName of message.fileNames) {
                        log.debug("Deleting file:", fileName)
                        await api.applyRemoteDelete(fileName)
                    }
                }
                break
            case "delete-prompt-cleared":
                dispatch({ type: "clear-pending-deletes", session: message.session, fileNames: message.fileNames })
                break
            case "conflicts-detected":
                log.debug(`Received ${message.conflicts.length} conflicts from CLI`)
                dispatch({ type: "conflicts", conflicts: message.conflicts, session: message.session })
                break
            case "conflicts-cleared":
                dispatch({ type: "clear-conflicts", session: message.session })
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
            default:
                log.warn("Unknown message type:", (message as unknown as { type: string }).type)
                break
        }
    }
}
