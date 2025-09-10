export type Range = readonly [start: number, end: number]

function indicesOf(haystack: string, needle: string): number[] {
    if (haystack.length === 0 || needle.length === 0) return []

    const indices: number[] = []

    let index = haystack.indexOf(needle)

    while (index !== -1) {
        indices.push(index)
        index = haystack.indexOf(needle, index + needle.length)
    }

    return indices
}

export function findRanges(text: string, query: string, isCaseSensitive: boolean): readonly Range[] {
    if (!text || !query) return []

    const haystack = isCaseSensitive ? text : text.toLowerCase()
    const needle = isCaseSensitive ? query : query.toLowerCase()

    const indices = indicesOf(haystack, needle)
    if (indices.length === 0) return []

    return indices.map((start): Range => [start, start + needle.length])
}

export function rangeLength([start, end]: Range): number {
    return end - start
}

/**
 * Converts a 0-based Range (string indices) to a 1-based CodeFilePosition (line/column numbers).
 */
export function rangeToCodeFileLocation([startColumn, endColumn]: Range, text: string) {
    function getLineAndColumn(index: number): { line: number; column: number } {
        const textBefore = text.slice(0, index)
        const allLines = textBefore.split("\n")
        const lastLine = allLines.at(-1) ?? ""

        return { line: allLines.length, column: lastLine.length + 1 }
    }

    const start = getLineAndColumn(startColumn)
    const end = getLineAndColumn(Math.max(endColumn - 1, 0))

    return {
        startColumn: start.column,
        endColumn: end.column + 1,
        startLine: start.line,
        endLine: end.line,
    }
}
