import type { Result } from "./types"

export interface GroupedResult {
    readonly entry: Result["entry"]
    readonly results: readonly Result[]
}

/** Groups the results by the result's entry id. */
export function groupResults(items: readonly Result[]): readonly GroupedResult[] {
    const entryMap = new Map<string, [Result, ...(readonly Result[])]>()

    for (const item of items) {
        const nodeId = item.entry.rootNode.id

        const nodeResults = entryMap.get(nodeId)

        if (!nodeResults) {
            entryMap.set(nodeId, [item])
        } else {
            nodeResults.push(item)
        }
    }

    return Array.from(entryMap.values()).map((results): GroupedResult => {
        const [first] = results
        return {
            entry: first.entry,
            results,
        }
    })
}
