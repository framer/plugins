import { useDeferredValue, useMemo } from "react"
import type { IndexEntry, RootNodeType } from "../indexer/types"
import { executeFilters } from "./execute-filter"
import type { ReadonlyGroupedResults } from "./group-results"
import { groupResults } from "./group-results"
import { type Filter, FilterType, type Matcher, MatcherType } from "./types"

export function useFilter(
    query: string,
    searchOptions: readonly RootNodeType[],
    index: readonly IndexEntry[]
): {
    results: ReadonlyGroupedResults
    hasResults: boolean
} {
    const deferredQuery = useDeferredValue(query)

    const matchers = useMemo((): readonly Matcher[] => {
        return [{ type: MatcherType.Text, query: deferredQuery, caseSensitive: false }]
    }, [deferredQuery])

    const filters = useMemo((): readonly Filter[] => {
        return [{ type: FilterType.RootNodes, rootNodes: searchOptions }]
    }, [searchOptions])

    const { hasResults, results } = useMemo(() => {
        const items = executeFilters(matchers, filters, index)

        return {
            results: groupResults(items),
            hasResults: items.length > 0,
        }
    }, [matchers, filters, index])

    return {
        results,
        hasResults,
    }
}
