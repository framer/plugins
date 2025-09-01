import { startTransition, useEffect, useMemo, useRef, useState } from "react"
import type { GlobalSearchDatabase } from "../db"
import type { RootNodeType } from "../indexer/types"
import { IdleCallbackAsyncProcessor } from "./AsyncProcessor"
import { createFilterFunction, type FilterFunction } from "./execute-filter"
import { FilterType, MatcherType, type Result } from "./types"

export interface AsyncFilterState {
    readonly results: readonly Result[]
    readonly hasResults: boolean
    readonly error: Error | null
    readonly running: boolean
}

export function useAsyncFilter(
    query: string,
    rootNodes: readonly RootNodeType[],
    database: GlobalSearchDatabase,
    dataVersion: number
): AsyncFilterState {
    const processorRef = useRef<IdleCallbackAsyncProcessor<Result> | null>(null)

    const [state, setState] = useState<AsyncFilterState>({
        results: [],
        hasResults: false,
        error: null,
        running: false,
    })

    const itemProcessor = useMemo((): FilterFunction => {
        const matchers = [{ type: MatcherType.Text, query, caseSensitive: false }]
        const filters = [{ type: FilterType.RootNodes, rootNodes }]
        return createFilterFunction(matchers, filters)
    }, [query, rootNodes])

    if (!processorRef.current) {
        processorRef.current = new IdleCallbackAsyncProcessor<Result>()

        const processor = processorRef.current

        processor.on("started", () => {
            // Not resetting the results here to avoid flickering
            startTransition(() => {
                setState(prev => ({ ...prev, error: null, running: true }))
            })
        })

        processor.on("progress", ({ results }) => {
            startTransition(() => {
                setState(state => ({
                    ...state,
                    results,
                    hasResults: results.length > 0,
                    error: null,
                }))
            })
        })

        processor.on("completed", () => {
            startTransition(() => {
                setState(state => ({ ...state, running: false }))
            })
        })

        processor.on("error", error => {
            setState(prev => ({ ...prev, error, running: false }))
        })
    }

    // start processing
    useEffect(() => {
        const processor = processorRef.current
        if (!processor) return

        void processor.start(database, itemProcessor)

        return () => {
            processor.abort()
        }
    }, [database, itemProcessor, dataVersion])

    return state
}
