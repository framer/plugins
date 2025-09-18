import { assert } from "../assert"
import { waitForIdle } from "../idle-utils"
import type { RootNodeType } from "../indexer/types"
import type { Range } from "./ranges"
import { type CollectionItemResult, type Result, ResultType } from "./types"

interface BasePreparedResult {
    readonly id: string
    readonly text: string
    readonly range: Range
}

interface PreparedCollectionItemResult extends BasePreparedResult {
    readonly type: ResultType.CollectionItemField
    readonly entry: CollectionItemResult["entry"]
    readonly matchingField: CollectionItemResult["matchingField"]
}

interface PreparedOtherResult extends BasePreparedResult {
    readonly type: ResultType.Node | ResultType.CodeFile
    readonly entry: Exclude<Result, CollectionItemResult>["entry"]
}

export type PreparedResult = PreparedCollectionItemResult | PreparedOtherResult

export interface PreparedGroup {
    readonly entry: Result["entry"]
    readonly matches: readonly PreparedResult[]
}

/**
 * Prepares groups and expands ranges into view-ready matches in one pass.
 */
export async function groupResults(
    items: readonly Result[],
    abortSignal?: AbortSignal
): Promise<readonly PreparedGroup[]> {
    const entryMap = new Map<string, [Result, ...(readonly Result[])]>()
    const totalItems = items.length

    let itemIndex = 0
    while (itemIndex < totalItems) {
        if (abortSignal?.aborted) throw new Error("Operation aborted")
        const deadline = await waitForIdle()
        while (itemIndex < totalItems && deadline.timeRemaining() > 0) {
            const item = items[itemIndex]
            assert(item, "Item should be defined in groupResults loop")
            const nodeId = item.entry.rootNodeId
            const nodeResults = entryMap.get(nodeId)
            if (!nodeResults) entryMap.set(nodeId, [item])
            else nodeResults.push(item)
            itemIndex++
        }
    }

    const groups: PreparedGroup[] = Array.from(entryMap.values()).map(results => {
        const [first] = results

        const matches: PreparedResult[] = []
        for (const result of results) {
            for (const range of result.ranges) {
                const id = `${result.id}-${range.join("-")}`
                if (result.type === ResultType.CollectionItemField) {
                    matches.push({
                        id,
                        type: result.type,
                        text: result.text,
                        range,
                        entry: result.entry,
                        matchingField: result.matchingField,
                    })
                } else {
                    matches.push({ id, type: result.type, text: result.text, range, entry: result.entry })
                }
            }
        }

        return { entry: first.entry, matches }
    })

    return groups.sort((a, b) => compareRootNodeTypeByPriority(a.entry.rootNodeType, b.entry.rootNodeType))
}

const orderOfResults = ["WebPageNode", "Collection", "ComponentNode", "CodeFile"] satisfies RootNodeType[]

export function compareRootNodeTypeByPriority(a: RootNodeType, b: RootNodeType): number {
    return orderOfResults.indexOf(a) - orderOfResults.indexOf(b)
}
