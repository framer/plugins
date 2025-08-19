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
    readonly isFiltering: boolean
    readonly progress: number
    readonly processedItems: number
    readonly totalItems: number
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
        isFiltering: false,
        progress: 0,
        processedItems: 0,
        totalItems: 0,
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
                setState(prev => ({ ...prev, isFiltering: true, error: null }))
            })
        })

        // use progress could cause item's to get removed when a new index comes in. If this causes issues,
        // we can move to using the completed event instead, on the tradeoff of having results later
        processor.on("progress", progress => {
            startTransition(() => {
                const uiResults = groupResults(progress.results)
                setState({
                    results: uiResults,
                    hasResults: progress.results.length > 0,
                    isFiltering: progress.isProcessing,
                    progress: progress.progress,
                    processedItems: progress.processedItems,
                    totalItems: progress.totalItems,
                    error: progress.error,
                })
            })
        })

        processor.on("error", error => {
            setState(prev => ({ ...prev, isFiltering: false, error }))
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
