export type Range = [start: number, end: number]

export function indicesOf(haystack: string, needle: string): number[] {
    if (haystack.length === 0 || needle.length === 0) return []

    const indices: number[] = []

    let index = haystack.indexOf(needle)

    while (index !== -1) {
        indices.push(index)
        index = haystack.indexOf(needle, index + needle.length)
    }

    return indices
}

export function isLowerCase(text: string): boolean {
    return text === text.toLowerCase() && text !== text.toUpperCase()
}

export function isUpperCase(text: string): boolean {
    return text !== text.toLowerCase() && text === text.toUpperCase()
}

export function matchCase(original: string, template: string): string {
    const maxIndex = Math.min(original.length, template.length)

    let output = ""

    for (let index = 0; index < original.length; index++) {
        const originalCharacter = original.charAt(index)

        if (index >= maxIndex) {
            output += originalCharacter
            continue
        }

        const templateCharacter = template.charAt(index)

        if (isUpperCase(templateCharacter)) {
            output += originalCharacter.toUpperCase()
            continue
        }

        output += originalCharacter
    }

    return output
}

export function replaceRange(text: string, replacement: string, start: number, end: number): string {
    const before = text.slice(0, start)
    const after = text.slice(end)

    return before + replacement + after
}

export function replaceAllRanges(text: string, replacement: string, ranges: Range[], preserveCase?: boolean) {
    let result: string = text
    let offset = 0

    for (const [start, end] of ranges) {
        const previousLength = result.length

        const offsetStart = start - offset
        const offsetEnd = end - offset

        result = replaceRange(
            result,
            preserveCase ? matchCase(replacement, result.slice(offsetStart, offsetEnd)) : replacement,
            offsetStart,
            offsetEnd
        )
        offset += previousLength - result.length
    }

    return result
}

export function pluralize(singular: string, plural: string, count: number) {
    if (count === 1) return singular
    return plural
}

export function capitalize(text: string) {
    if (text.length === 0) return text

    const firstCharacter = text.charAt(0)
    return firstCharacter.toUpperCase() + text.slice(1, text.length)
}

export function findRanges(text: string, query: string, isCaseSensitive: boolean, isRegex: boolean): Range[] {
    if (!text || !query) return []

    const haystack = isCaseSensitive ? text : text.toLowerCase()
    const needle = isCaseSensitive ? query : query.toLowerCase()

    if (isRegex) {
        const regex = new RegExp(needle, "g")
        const matches = haystack.matchAll(regex)

        const ranges: Range[] = []

        for (const match of matches) {
            const start = match.index
            const end = start + match[0].length

            ranges.push([start, end])
        }

        return ranges
    }

    const indices = indicesOf(haystack, needle)
    if (indices.length === 0) return []

    const ranges: Range[] = []

    for (const start of indices) {
        ranges.push([start, start + needle.length])
    }

    return ranges
}

export function randomID() {
    return `${Date.now()}-${Math.floor(Math.random() * 100)}`
}
