import { diffWords } from "diff"
import type { InlineDiff } from "./types"

/**
 * Generates word-level differences between two strings.
 *
 * @param oldStr - The original string
 * @param newStr - The revised string
 * @returns Array of InlineDiff objects representing word-level changes
 */
export function getInlineDiff(oldStr: string, newStr: string): InlineDiff[] {
    if (oldStr === newStr) {
        return [{ type: "unchanged", value: oldStr }]
    }

    const diffs = diffWords(oldStr, newStr)
    return diffs.map(diff => {
        if (diff.added) {
            return { type: "add" as const, value: diff.value }
        }
        if (diff.removed) {
            return { type: "remove" as const, value: diff.value }
        }
        return { type: "unchanged" as const, value: diff.value }
    })
}
