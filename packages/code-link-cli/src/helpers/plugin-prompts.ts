/**
 * Plugin User Prompt Coordinator
 *
 * Provides a clean awaitable API for user confirmations via the Plugin UI.
 * Manages pending promises that resolve when the user responds in Framer.
 */

import type { PromptSession } from "@code-link/shared"
import { randomUUID } from "node:crypto"
import type { WebSocket } from "ws"
import type { Conflict } from "../types.ts"
import { debug } from "../utils/logging.ts"
import { sendMessage } from "./connection.ts"

class PluginDisconnectedError extends Error {
    constructor() {
        super("Plugin disconnected")
        this.name = "PluginDisconnectedError"
    }
}

interface PendingAction {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
}

export function deletePromptActionId(session: PromptSession, fileName: string): string {
    return `delete:${session.connectionId}:${session.promptId}:${fileName}`
}

export function conflictPromptActionId(session: PromptSession, fileName: string): string {
    return `conflict:${session.connectionId}:${session.promptId}:${fileName}`
}

export class PluginUserPromptCoordinator {
    private pendingActions = new Map<string, PendingAction>()

    /**
     * Register a pending action and return a typed promise
     */
    private awaitAction<T>(actionId: string, description: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.pendingActions.set(actionId, {
                resolve: resolve as (value: unknown) => void,
                reject,
            })
            debug(`Awaiting ${description}: ${actionId}`)
        })
    }

    /**
     * Sends the delete request to the plugin and awaits the user's decision.
     * Returns the list of fileNames that were confirmed for deletion.
     */
    async requestDeleteDecision(
        socket: WebSocket | null,
        {
            fileNames,
            requireConfirmation,
            session,
        }: { fileNames: string[]; requireConfirmation: boolean; session: PromptSession }
    ): Promise<string[]> {
        if (!socket) {
            throw new Error("Cannot request delete decision: plugin not connected")
        }

        if (fileNames.length === 0) {
            return []
        }

        if (requireConfirmation) {
            const confirmationPromises = fileNames.map(fileName =>
                this.awaitAction<boolean>(deletePromptActionId(session, fileName), "delete confirmation")
                    .then(confirmed => (confirmed ? fileName : null))
                    .catch(err => {
                        if (err instanceof PluginDisconnectedError) {
                            debug(`Plugin disconnected while waiting for delete confirmation: ${fileName}`)
                            return null
                        }
                        throw err
                    })
            )

            await sendMessage(socket, {
                type: "file-delete",
                fileNames,
                requireConfirmation: true,
                session,
            })

            const results = await Promise.all(confirmationPromises)
            return results.filter((name): name is string => name !== null)
        }

        await sendMessage(socket, {
            type: "file-delete",
            fileNames,
            requireConfirmation: false,
            session,
        })

        return fileNames
    }

    /**
     * Sends conflicts to the plugin and awaits user resolutions
     */
    async requestConflictDecisions(
        socket: WebSocket | null,
        conflicts: Conflict[],
        session: PromptSession
    ): Promise<Map<string, "local" | "remote">> {
        if (!socket) {
            throw new Error("Cannot request conflict decision: plugin not connected")
        }

        if (conflicts.length === 0) {
            return new Map()
        }

        const pending = conflicts.map(conflict => ({
            fileName: conflict.fileName,
            promise: this.awaitAction<"local" | "remote">(
                conflictPromptActionId(session, conflict.fileName),
                "conflict resolution"
            ),
        }))

        await sendMessage(socket, {
            type: "conflicts-detected",
            conflicts,
            session,
        })

        try {
            const results = await Promise.all(
                pending.map(async ({ fileName, promise }) => [fileName, await promise] as const)
            )

            return new Map(results)
        } catch (err) {
            if (err instanceof PluginDisconnectedError) {
                debug("Plugin disconnected while awaiting conflict decisions")
                return new Map()
            }
            throw err
        }
    }

    /**
     * Resolve a pending prompt (boolean for deletes, resolution for conflicts).
     */
    resolvePendingAction<T>(actionId: string, value: T): boolean {
        const pending = this.pendingActions.get(actionId)
        if (!pending) {
            debug(`Unexpected prompt resolution for ${actionId}`)
            return false
        }

        this.pendingActions.delete(actionId)
        pending.resolve(value)
        debug(`Resolved: ${actionId}`)
        return true
    }

    /**
     * @deprecated use resolvePendingAction
     */
    handleConfirmation(actionId: string, value: boolean): boolean {
        return this.resolvePendingAction(actionId, value)
    }

    /**
     * Cleanup all pending actions (e.g., on disconnect)
     */
    cleanup(): void {
        for (const [actionId, pending] of this.pendingActions.entries()) {
            pending.reject(new PluginDisconnectedError())
            debug(`Cancelled pending action: ${actionId}`)
        }
        this.pendingActions.clear()
    }
}

export function createPromptSession(connectionId: number): PromptSession {
    return { connectionId, promptId: randomUUID() }
}
