import type { Installer } from "./helpers/installer.ts"
import { PluginUserPromptCoordinator } from "./helpers/plugin-prompts.ts"
import { SyncBase } from "./sync-base.ts"

export interface PendingRenameConfirmation {
    oldFileName: string
    content: string
}

/**
 * Owns mutable sync runtime state: peer base model, prompts, pending renames, installer.
 */
export class SyncKernel {
    readonly base: SyncBase
    readonly pendingRenameConfirmations = new Map<string, PendingRenameConfirmation>()
    readonly userActions = new PluginUserPromptCoordinator()
    installer: Installer | null = null

    constructor() {
        this.base = new SyncBase()
    }
}
