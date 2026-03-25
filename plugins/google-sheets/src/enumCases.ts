import { generateHashId, isDefined } from "./utils"

type EnumCaseLike = {
    id: string
    name: string
}

type EnumCaseCellValue = string | number | boolean | null

export function getEnumCasesForColumn(
    rows: ReadonlyArray<ReadonlyArray<EnumCaseCellValue>>,
    colIndex: number
): EnumCaseLike[] {
    const cases: EnumCaseLike[] = []
    const seenValues = new Set<string>()

    for (const row of rows) {
        const rawValue = row[colIndex]
        if (!isDefined(rawValue)) continue

        const normalizedValue = String(rawValue).trim()
        if (!normalizedValue || seenValues.has(normalizedValue)) continue

        seenValues.add(normalizedValue)
        cases.push({
            id: generateHashId(normalizedValue),
            name: normalizedValue,
        })
    }

    return cases
}

export function mergeEnumCases(
    existingCases: readonly EnumCaseLike[] | undefined,
    derivedCases: readonly EnumCaseLike[]
): EnumCaseLike[] {
    const mergedCases: EnumCaseLike[] = []
    const seenCaseNames = new Set<string>()

    for (const existingCase of existingCases ?? []) {
        if (seenCaseNames.has(existingCase.name)) continue

        seenCaseNames.add(existingCase.name)
        mergedCases.push(existingCase)
    }

    for (const derivedCase of derivedCases) {
        if (seenCaseNames.has(derivedCase.name)) continue

        seenCaseNames.add(derivedCase.name)
        mergedCases.push(derivedCase)
    }

    return mergedCases
}

export function areEnumCasesEqual(
    leftCases: readonly EnumCaseLike[] | undefined,
    rightCases: readonly EnumCaseLike[] | undefined
): boolean {
    const left = leftCases ?? []
    const right = rightCases ?? []

    if (left.length !== right.length) return false

    for (let i = 0; i < left.length; i++) {
        const leftCase = left[i]
        const rightCase = right[i]

        if (!leftCase || !rightCase) return false
        if (leftCase.id !== rightCase.id || leftCase.name !== rightCase.name) return false
    }

    return true
}
