import type { IndexEntry } from "../indexer/types"
import { findRanges } from "./ranges"
import { type Filter, type Matcher, type Result, ResultType, type RootNodesFilter } from "./types"

/** Execute a list of filters on a list of entries and return the results. */
export function executeFilters(
    /** The matchers to execute on the index. */
    matchers: readonly Matcher[],
    /** A filter to narrow down the results. */
    filters: readonly Filter[],
    /** The index to search on */
    index: readonly IndexEntry[]
): Result[] {
    const results: Result[] = []

    for (const entry of index) {
        let include = true
        let result: Result | undefined

        for (const matcher of matchers) {
            const matchResult = executeMatcher(matcher, entry)

            if (matchResult === undefined) {
                include = false
                break
            }

            if (filters.some(filter => executeFilter(filter, matchResult))) {
                result = matchResult
            }
        }

        if (include && result) {
            results.push(result)
        }
    }

    return results
}

/** Execute a matcher on a single entry and routes to the appropriate matcher function. */
function executeMatcher(matcher: Matcher, entry: IndexEntry): Result | undefined {
    if (!entry.text) return undefined

    const ranges = findRanges(entry.text, matcher.query, matcher.caseSensitive)
    if (!ranges.length) return undefined

    if (entry.type === "CollectionItemField") {
        return {
            id: `${entry.id}-${entry.matchingField.id}`,
            matchingField: entry.matchingField,
            text: entry.text,
            ranges,
            entry,
            type: ResultType.CollectionItemField,
        }
    }

    return {
        id: entry.id,
        text: entry.text,
        ranges,
        entry,
        type: ResultType.Node,
    }
}

/** Execute a filter on a result and return true if the result should be included. */
function executeFilter(filter: Filter, result: Result): boolean {
    // When more filters are added, we can add more filter functions here and use this as a router
    return executeRootNodesFilter(filter, result)
}

function executeRootNodesFilter(filter: RootNodesFilter, result: Result): boolean {
    return filter.rootNodes.includes(result.entry.rootNodeType)
}
