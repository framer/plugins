/**
 * Truncates text from the start, keeping the specified maximum length.
 * Attempts to break at word boundaries when possible to avoid cutting words in half.
 */
export function truncateFromStart(
    text: string,
    maxLength: number,
    options: { wordBoundaryThreshold?: number; ellipsis?: string } = {}
) {
    if (text.length <= maxLength) return text
    if (maxLength <= 0) return options.ellipsis ?? "…"

    const { wordBoundaryThreshold = 8, ellipsis = "…" } = options
    const trimmed = text.slice(-maxLength)

    const firstSpaceIndex = trimmed.indexOf(" ")
    const shouldBreakAtWord = firstSpaceIndex > 0 && firstSpaceIndex < wordBoundaryThreshold
    const result = shouldBreakAtWord ? trimmed.slice(firstSpaceIndex) : trimmed

    return `${ellipsis}${result.trimStart()}`
}
