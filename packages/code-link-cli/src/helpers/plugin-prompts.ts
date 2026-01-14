/**
 * Plugin User Prompt Coordinator
 *
 * Provides a clean awaitable API for user confirmations via the Plugin UI.
 * Manages pending promises that resolve when the user responds in Framer.
 */

import type { WebSocket } from "ws"
import type { Conflict } from "../types.js"
import { debug, warn } from "../utils/logging.js"
import { sendMessage } from "./connection.js"

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
     * Sends the delete request to the plugin and awaits the user's decision
     */
    async requestDeleteDecision(
        socket: WebSocket | null,
        { fileName, requireConfirmation }: { fileName: string; requireConfirmation: boolean }
    ): Promise<boolean> {
        if (!socket) {
            throw new Error("Cannot request delete decision: plugin not connected")
        }

        if (requireConfirmation) {
            const confirmationPromise = this.awaitAction<boolean>(`delete:${fileName}`, "delete confirmation")

            await sendMessage(socket, {
                type: "file-delete",
                fileNames: [fileName],
                requireConfirmation: true,
            })

            try {
                return await confirmationPromise
            } catch (err) {
                if (err instanceof PluginDisconnectedError) {
                    debug(`Plugin disconnected while waiting for delete confirmation: ${fileName}`)
                    return false
                }
                throw err
            }
        }

        await sendMessage(socket, {
            type: "file-delete",
            fileNames: [fileName],
            requireConfirmation: false,
        })

        return true
    }

    /**
     * Sends conflicts to the plugin and awaits user resolutions
     */
    async requestConflictDecisions(
        socket: WebSocket | null,
        conflicts: Conflict[]
    ): Promise<Map<string, "local" | "remote">> {
        if (!socket) {
            throw new Error("Cannot request conflict decision: plugin not connected")
        }

        if (conflicts.length === 0) {
            return new Map()
        }

        const pending = conflicts.map(conflict => ({
            fileName: conflict.fileName,
            promise: this.awaitAction<"local" | "remote">(`conflict:${conflict.fileName}`, "conflict resolution"),
        }))

        await sendMessage(socket, {
            type: "conflicts-detected",
            conflicts,
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
     * Handle incoming confirmation response
     */
    handleConfirmation(actionId: string, value: boolean): boolean {
        const pending = this.pendingActions.get(actionId)
        if (!pending) {
            debug(`Unexpected confirmation for ${actionId}`)
            return false
        }

        this.pendingActions.delete(actionId)
        pending.resolve(value)
        debug(`Confirmed: ${actionId}`)
        return true
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
