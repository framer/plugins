export const removeItemAtIndex = <T>(array: T[] | null, index: number): T[] => {
    if (!array) return []
    return [...array.slice(0, index), ...array.slice(index + 1)]
}
