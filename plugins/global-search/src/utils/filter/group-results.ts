import { assert } from "../assert"
import { waitForIdle } from "../idle-utils"
import type { RootNodeType } from "../indexer/types"
import type { Result } from "./types"

export interface EntryResult {
    readonly entry: Result["entry"]
    readonly results: readonly Result[]
}

/**
 * Groups the results by the result's entry id using idle time processing.
 * This prevents blocking the renderer when processing large amounts of results.
 */
export async function groupResults(
    items: readonly Result[],
    abortSignal?: AbortSignal
): Promise<readonly EntryResult[]> {
    const entryMap = new Map<string, [Result, ...(readonly Result[])]>()
    const totalItems = items.length

    let itemIndex = 0
    while (itemIndex < totalItems) {
        // Check for abortion before processing
        if (abortSignal?.aborted) {
            throw new Error("Operation aborted")
        }

        // Wait for idle time before processing
        const deadline = await waitForIdle()

        // Process items while we have idle time available
        while (itemIndex < totalItems && deadline.timeRemaining() > 0) {
            const item = items[itemIndex]
            assert(item, "Item should be defined in groupResults loop")

            const nodeId = item.entry.rootNodeId
            const nodeResults = entryMap.get(nodeId)

            if (!nodeResults) {
                entryMap.set(nodeId, [item])
            } else {
                nodeResults.push(item)
            }

            itemIndex++
        }
    }

    return Array.from(entryMap.values())
        .map((results): EntryResult => {
            const [first] = results
            return {
                entry: first.entry,
                results,
            }
        })
        .sort((a, b) => compareRootNodeTypeByPriority(a.entry.rootNodeType, b.entry.rootNodeType))
}

const orderOfResults = ["WebPageNode", "Collection", "ComponentNode", "CodeFile"] satisfies RootNodeType[]

export function compareRootNodeTypeByPriority(a: RootNodeType, b: RootNodeType): number {
    return orderOfResults.indexOf(a) - orderOfResults.indexOf(b)
}
