import type { IndexEntry } from "../indexer/types"
import { findRanges } from "./ranges"
import { type Filter, type Matcher, type Result, ResultType, type RootNodesFilter } from "./types"

export type FilterFunction = (entry: IndexEntry) => Result | false

/** Create a filter function that can process a single entry. */
export function createFilterFunction(
    /** The matchers to execute on entries. */
    matchers: readonly Matcher[],
    /** A filter to narrow down the results. */
    filters: readonly Filter[]
): FilterFunction {
    return entry => {
        let result: Result | false = false

        for (const matcher of matchers) {
            const matchResult = executeMatcher(matcher, entry)

            if (matchResult === undefined) {
                return false
            }

            if (filters.some(filter => executeFilter(filter, matchResult))) {
                result = matchResult
            }
        }

        return result
    }
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
