import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import type { GlobalSearchDatabase } from "../db"
import type { RootNodeType } from "../indexer/types"
import { IdleCallbackAsyncProcessor } from "./AsyncProcessor"
import { createFilterFunction, type FilterFunction } from "./execute-filter"
import type { PreparedGroup } from "./group-results"
import { groupResults as groupResults } from "./group-results"
import { FilterType, MatcherType, type Result } from "./types"

export enum AsyncFilterStatus {
    Initial,
    Running,
    Completed,
}

export interface AsyncFilterState {
    readonly results: readonly PreparedGroup[]
    readonly resultsForQuery: string
    readonly error: Error | null
    readonly status: AsyncFilterStatus
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
    const queryRef = useRef(query)
    const groupingAbortControllerRef = useRef<AbortController | null>(null)

    const [state, setState] = useState<AsyncFilterState>({
        results: [],
        resultsForQuery: query,
        error: null,
        status: AsyncFilterStatus.Initial,
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
                setState(prev => ({
                    ...prev,
                    error: null,
                    status: AsyncFilterStatus.Running,
                    resultsForQuery: queryRef.current,
                }))
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
                        status: AsyncFilterStatus.Running,
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
                        setState(state => ({
                            ...state,
                            results,
                            status: AsyncFilterStatus.Completed,
                            error: null,
                        }))
                    })
                })
            })
        })

        processor.on("error", error => {
            setState(prev => ({ ...prev, error, status: AsyncFilterStatus.Completed }))
        })
    }

    useEffect(() => {
        const processor = processorRef.current
        if (!processor) return

        queryRef.current = query
        void processor.start(database, itemProcessor)

        return () => {
            processor.abort()
        }
    }, [database, itemProcessor, dataVersion, query])

    return state
}
