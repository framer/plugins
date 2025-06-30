import { createDividerLine } from "./line-creators"
import type { LineDiff } from "./types"

const CONTEXT_LINES = 2

/**
 * Reduces the number of context lines around changes and adds separators
 * where context has been truncated.
 */
export function addContextLimitingAndDividers(diffs: LineDiff[]): LineDiff[] {
    const changeIndices = getChangeIndices(diffs)
    if (changeIndices.length === 0) return diffs

    return markIncludedLines(diffs, changeIndices, CONTEXT_LINES)
        .map((include, lineIndex) => {
            if (!include) return null
            const diff = diffs[lineIndex]
            if (diff) return diff
            return createDividerLine([lineIndex, lineIndex + 1])
        })
        .filter((line): line is LineDiff => line !== null)
}

function isChange(d: LineDiff): boolean {
    return d.type === "change" || d.type === "add" || d.type === "remove"
}

function getChangeIndices(diffs: LineDiff[]): number[] {
    return diffs.map((d, i) => (isChange(d) ? i : -1)).filter(i => i !== -1)
}

function markIncludedLines(diffs: LineDiff[], changeIndices: number[], maxContextLines: number): boolean[] {
    return diffs.map((d, i) =>
        changeIndices.some(idx => Math.abs(i - idx) <= maxContextLines && (d.type === "context" || isChange(d)))
    )
}
