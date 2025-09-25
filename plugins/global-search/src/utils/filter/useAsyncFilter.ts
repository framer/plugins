import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import type { GlobalSearchDatabase } from "../db"
import type { RootNodeType } from "../indexer/types"
import { IdleCallbackAsyncProcessor } from "./AsyncProcessor"
import { createFilterFunction, type FilterFunction } from "./execute-filter"
import type { PreparedGroup } from "./group-results"
import { groupResults as groupResults } from "./group-results"
import { FilterType, MatcherType, type Result } from "./types"

export interface AsyncFilterState {
    readonly results: readonly PreparedGroup[]
    readonly hasResults: boolean
    readonly error: Error | null
    readonly running: boolean
}

export function useAsyncFilter(
    query: string,
    rootNodes: readonly RootNodeType[],
    database: GlobalSearchDatabase,
    {
        dataVersion,
    }: { restartOnVersionChange: true; dataVersion: number } | { restartOnVersionChange: false; dataVersion?: never }
): AsyncFilterState {
    const processorRef = useRef<IdleCallbackAsyncProcessor<Result> | null>(null)
    /** If this matches the current query and root nodes, we don't update the results with each progress update but instead wait for the completed event */
    const finalisedResultsForQueryRef = useRef<[string, readonly RootNodeType[]] | null>(null)
    const groupingAbortControllerRef = useRef<AbortController | null>(null)

    const [state, setState] = useState<AsyncFilterState>({
        results: [],
        hasResults: false,
        error: null,
        running: false,
    })
    const [, startTransition] = useTransition()

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
            const [finalisedQuery, finalisedRootNodes] = finalisedResultsForQueryRef.current ?? [null, null]
            // Final = we can wait for the completed event. There is already a lot of results to look through
            if (finalisedQuery === query && Object.is(finalisedRootNodes, rootNodes)) return

            groupingAbortControllerRef.current?.abort()
            const controller = new AbortController()
            groupingAbortControllerRef.current = controller

            void groupResults(results, controller.signal).then(results => {
                startTransition(() => {
                    setState(state => ({
                        ...state,
                        results,
                        hasResults: results.length > 0,
                        error: null,
                    }))
                })
            })
        })

        processor.on("completed", results => {
            startTransition(() => {
                groupingAbortControllerRef.current?.abort()
                const controller = new AbortController()
                groupingAbortControllerRef.current = controller

                void groupResults(results, controller.signal).then(results => {
                    startTransition(() => {
                        finalisedResultsForQueryRef.current = [query, rootNodes]
                        setState(state => ({ ...state, results, running: false }))
                    })
                })
            })
        })

        processor.on("error", error => {
            setState(prev => ({ ...prev, error, running: false }))
        })
    }

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
