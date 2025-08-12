import type { IndexEntry, RootNodeType } from "../indexer/types"
import type { ReadonlyRecord } from "../object"
import type { Result } from "./types"

export type GroupedResults = { [type in RootNodeType]?: Record<IndexEntry["id"], Result[]> }
export type ReadonlyGroupedResults = {
    readonly [type in RootNodeType]?: ReadonlyRecord<IndexEntry["id"], readonly Result[]>
}

/** Groups the results by root node type and the result's entry id. */
export function groupResults(items: readonly Result[]): ReadonlyGroupedResults {
    const grouped: GroupedResults = {}
    for (const item of items) {
        let rootNodeGroup = grouped[item.entry.rootNodeType]
        if (!rootNodeGroup) {
            rootNodeGroup = {}
            grouped[item.entry.rootNodeType] = rootNodeGroup
        }

        let rootNode = rootNodeGroup[item.entry.rootNode.id]
        if (!rootNode) {
            rootNode = []
            rootNodeGroup[item.entry.rootNode.id] = rootNode
        }

        rootNode.push(item)
    }

    return grouped
}
