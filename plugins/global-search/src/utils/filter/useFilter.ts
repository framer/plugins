import { useDeferredValue, useMemo } from "react"
import type { IndexEntry, RootNodeType } from "../indexer/types"
import { executeFilters } from "./execute-filter"
import type { ReadonlyGroupedResults } from "./group-results"
import { groupResults } from "./group-results"
import { type Filter, FilterType } from "./types"

export function useFilter(
    query: string,
    searchOptions: readonly RootNodeType[],
    index: readonly IndexEntry[]
): {
    results: ReadonlyGroupedResults
} {
    const deferredQuery = useDeferredValue(query)

    const filters = useMemo((): readonly Filter[] => {
        return [
            { type: FilterType.Text, query: deferredQuery, caseSensitive: false },
            { type: FilterType.RootNodes, rootNodes: searchOptions },
        ]
    }, [deferredQuery, searchOptions])

    const results = useMemo(() => {
        const items = executeFilters(filters, index)

        return groupResults(items)
    }, [filters, index])

    return {
        results,
    }
}
