import { assertNever } from "../assert"
import type { IndexCollectionItemEntry, IndexEntry, IndexNodeEntry } from "../indexer/types"
import { findRanges } from "./ranges"
import { type Filter, FilterType, type Result, ResultType, type RootNodesFilter, type TextFilter } from "./types"

/** Execute a list of filters on a list of entries and return the results. */
export function executeFilters(filters: readonly Filter[], index: readonly IndexEntry[]): Result[] {
    const results: Result[] = []

    for (const entry of index) {
        let include = true
        let result: Result | undefined

        for (const filter of filters) {
            const filterResult = executeFilter(filter, entry)

            if (typeof filterResult !== "boolean") {
                result = filterResult
            }

            if (filterResult === false) {
                include = false
                break
            }
        }

        if (include && result) {
            results.push(result)
        }
    }

    return results
}

/** Execute a filter on a single entry and routes to the appropriate filter function. */
function executeFilter(filter: Filter, entry: IndexEntry): FilterResult {
    switch (filter.type) {
        case FilterType.Text:
            if (entry.type === "CollectionItem") {
                return executeTextFilterForCollectionItems(filter, entry)
            }
            return executeTextFilterForNodes(filter, entry)
        case FilterType.RootNodes:
            return executeRootNodesFilter(filter, entry)
        default:
            assertNever(filter)
    }
}

/** Internal type for filter execution. When result is `false`, the entry is excluded. When result is `true` or `Result`, the entry is included. */
type FilterResult = Result | boolean

function executeTextFilterForNodes(filter: TextFilter, entry: IndexNodeEntry): FilterResult {
    const text = entry.text ?? entry.name
    if (!text) return false

    const ranges = findRanges(text, filter.query, filter.caseSensitive)
    if (!ranges.length) return false

    return {
        id: entry.id,
        text: text,
        ranges,
        entry,
        type: ResultType.Node,
    }
}

function executeTextFilterForCollectionItems(filter: TextFilter, entry: IndexCollectionItemEntry): FilterResult {
    // FIXME: This only returns the first matching field
    // Instead of having multiple fields in the index, we should have a single entry per field in the index
    for (const [field, text] of Object.entries(entry.fields)) {
        const ranges = findRanges(text, filter.query, filter.caseSensitive)
        if (ranges.length) {
            return {
                id: `${entry.id}-${field}`,
                field,
                text,
                ranges,
                entry,
                type: ResultType.CollectionItem,
            }
        }
    }

    return false
}

function executeRootNodesFilter(filter: RootNodesFilter, entry: IndexEntry): FilterResult {
    return filter.rootNodes.includes(entry.rootNodeType)
}
