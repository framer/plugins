import { createDividerLine } from "./line-creators"
import { isDivider } from "./typeChecks.ts"
import { type LineDiff } from "./types"

const CONTEXT_LINES = 2

/**
 * Reduces the number of context lines around changes and adds separators
 * where context has been truncated.
 */
export function addContextLimitingAndDividers(diffs: LineDiff[]): LineDiff[] {
    const changeIndices = getChangeIndices(diffs)
    if (changeIndices.length === 0) return diffs

    const result = markIncludedLines(diffs, changeIndices, CONTEXT_LINES)
        // looping over the diffs multiple times is not ideal, but here, it's a trade-off between performance and readability
        // and we're going for readability in this particular case
        // In many other cases, we'd want to use a more performant approach.
        .map((include, lineIndex) => {
            if (!include) return createDividerLine(lineIndex)
            const diff = diffs[lineIndex]
            if (diff) return diff
            return null
        })
        .filter((diff, index, array): diff is LineDiff => {
            if (!diff) return false

            // Skip consecutive dividers
            const next = array[index + 1]
            if (!next) return true
            if (isDivider(diff) && isDivider(next)) return false
            return true
        })

    // after filtering, the first or last item should never be a divider
    // it has to happen here, because we're filtering out dividers, which changes what the last item could be
    if (isDivider(result[0])) result.shift()
    if (isDivider(result[result.length - 1])) result.pop()

    return result
}

function isChange(d: LineDiff): boolean {
    return d.type === "change" || d.type === "add" || d.type === "remove"
}

function getChangeIndices(diffs: LineDiff[]): number[] {
    const indices: number[] = []
    for (const [index, diff] of diffs.entries()) {
        if (!isChange(diff)) continue

        indices.push(index)
    }
    return indices
}

function markIncludedLines(diffs: LineDiff[], changeIndices: number[], maxContextLines: number): boolean[] {
    const getShouldInclude = (diff: LineDiff, index: number) =>
        changeIndices.some(
            changeIndex =>
                Math.abs(index - changeIndex) <= maxContextLines && (diff.type === "context" || isChange(diff))
        )

    return diffs.map((diff, index) => getShouldInclude(diff, index))
}
