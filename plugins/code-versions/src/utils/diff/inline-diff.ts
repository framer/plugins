import { diffWords } from "diff"
import { match } from "ts-pattern"
import type { InlineDiff } from "./types"

/**
 * Converts a diff part from the 'diff' library into our InlineDiff format.
 * Now trims and preserves leading/trailing whitespace as unchanged.
 */
export function getInlineDiff(originalLine: string, revisedLine: string): InlineDiff[] {
    // Extract whitespace and core content for diffing
    const { leading, trailing, originalCore, revisedCore } = getWhitespaceAndCoreParts(originalLine, revisedLine)
    const result: InlineDiff[] = []
    if (leading) result.push({ type: "unchanged" as const, value: leading })
    result.push(
        ...diffWords(originalCore, revisedCore).map(part =>
            match(part)
                .returnType<InlineDiff>()
                .with({ added: true }, () => ({ type: "add", value: part.value }))
                .with({ removed: true }, () => ({ type: "remove", value: part.value }))
                .otherwise(() => ({ type: "unchanged", value: part.value }))
        )
    )
    if (trailing) result.push({ type: "unchanged" as const, value: trailing })
    return result
}

// We can't use trim() here: we need to preserve and compare leading/trailing whitespace so it can be shown as unchanged if it matches, not just removed.
// Example:
//   '  old line  ' vs '  new line  '
//   Should diff as: [unchanged: '  '][remove: 'old'][add: 'new'][unchanged: ' line  ']
//   Using trim() would lose the spaces and context.

function getWhitespaceAndCoreParts(original: string, revised: string) {
    const commonLeadingWhitespace = getCommonLeadingWhitespace(original, revised)
    const commonTrailingWhitespace = getCommonTrailingWhitespace(original, revised)

    return {
        leading: commonLeadingWhitespace,
        trailing: commonTrailingWhitespace,
        originalCore: original.slice(commonLeadingWhitespace.length, original.length - commonTrailingWhitespace.length),
        revisedCore: revised.slice(commonLeadingWhitespace.length, revised.length - commonTrailingWhitespace.length),
    }
}

// Extracts the common leading and trailing whitespace between two strings
function getCommonLeadingWhitespace(original: string, revised: string): string {
    const originalLeading = getLeadingWhitespace(original)
    const revisedLeading = getLeadingWhitespace(revised)
    const leadingLength = countCommonLeadingLength(originalLeading, revisedLeading)
    return originalLeading.slice(0, leadingLength)
}

function getCommonTrailingWhitespace(original: string, revised: string): string {
    const originalTrailing = getTrailingWhitespace(original)
    const revisedTrailing = getTrailingWhitespace(revised)
    const trailingLength = countCommonTrailingLength(originalTrailing, revisedTrailing)
    return originalTrailing.slice(originalTrailing.length - trailingLength)
}

function getLeadingWhitespace(str: string): string {
    return /^\s*/.exec(str)?.[0] ?? ""
}

function getTrailingWhitespace(str: string): string {
    return /\s*$/.exec(str)?.[0] ?? ""
}

function countCommonLeadingLength(a: string, b: string): number {
    const maxLength = Math.min(a.length, b.length)
    let count = 0
    for (let i = 0; i < maxLength; i++) {
        if (a[i] !== b[i]) break
        count++
    }
    return count
}

function countCommonTrailingLength(a: string, b: string): number {
    const maxLength = Math.min(a.length, b.length)
    let count = 0
    for (let i = 1; i <= maxLength; i++) {
        if (a[a.length - i] !== b[b.length - i]) break
        count++
    }
    return count
}
