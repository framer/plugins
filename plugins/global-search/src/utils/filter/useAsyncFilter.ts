import { startTransition, useEffect, useMemo, useRef, useState } from "react"
import type { IndexEntry, RootNodeType } from "../indexer/types"
import { TimeBasedAsyncProcessor } from "./AsyncProcessor"
import { createFilterFunction, type FilterFunction } from "./execute-filter"
import type { EntryResult } from "./group-results"
import { groupResults } from "./group-results"
import { FilterType, MatcherType, type Result } from "./types"

export interface AsyncFilterState {
    readonly results: readonly EntryResult[]
    readonly hasResults: boolean
    readonly error: Error | null
}

export function useAsyncFilter(
    query: string,
    rootNodes: readonly RootNodeType[],
    index: readonly IndexEntry[]
): AsyncFilterState {
    const processorRef = useRef<TimeBasedAsyncProcessor<IndexEntry, Result> | null>(null)

    const [state, setState] = useState<AsyncFilterState>({
        results: [],
        hasResults: false,
        error: null,
    })

    const itemProcessor = useMemo((): FilterFunction => {
        const matchers = [{ type: MatcherType.Text, query, caseSensitive: false }]
        const filters = [{ type: FilterType.RootNodes, rootNodes }]
        return createFilterFunction(matchers, filters)
    }, [query, rootNodes])

    if (!processorRef.current) {
        processorRef.current = new TimeBasedAsyncProcessor<IndexEntry, Result>()

        const processor = processorRef.current

        processor.on("started", () => {
            // Not resetting the results here to avoid flickering
            startTransition(() => {
                setState(prev => ({ ...prev, error: null }))
            })
        })

        processor.on("completed", results => {
            startTransition(() => {
                const uiResults = groupResults(results)
                setState({
                    results: uiResults,
                    hasResults: results.length > 0,
                    error: null,
                })
            })
        })

        processor.on("error", error => {
            setState(prev => ({ ...prev, error }))
        })
    }

    // start processing
    useEffect(() => {
        const processor = processorRef.current
        if (!processor) return

        void processor.start(index, itemProcessor)

        return () => {
            processor.abort()
        }
    }, [query, rootNodes, index, itemProcessor])

    return state
}
