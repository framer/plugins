import { randomUUID } from "node:crypto"
import type { PromptSession } from "@code-link/shared"

export function deletePromptActionId(session: PromptSession, fileName: string): string {
    return `delete:${session.connectionId}:${session.promptId}:${fileName}`
}

export function conflictPromptActionId(session: PromptSession, fileName: string): string {
    return `conflict:${session.connectionId}:${session.promptId}:${fileName}`
}

export function createPromptSession(connectionId: number): PromptSession {
    return { connectionId, promptId: randomUUID() }
}
