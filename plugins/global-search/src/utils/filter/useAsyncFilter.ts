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
    const groupingAbortControllerRef = useRef<AbortController | null>(null)

    const [state, setState] = useState<AsyncFilterState>({
        results: [],
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
                }))
            })
        })

        processor.on("completed", results => {
            startTransition(() => {
                groupingAbortControllerRef.current?.abort()
                const controller = new AbortController()
                groupingAbortControllerRef.current = controller

                void groupResults(results, controller.signal).then(results => {
                    startTransition(() => {
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

        if (query === "") {
            startTransition(() => {
                setState(prev => ({ ...prev, results: [], status: AsyncFilterStatus.Initial }))
            })
        } else {
            void processor.start(database, itemProcessor)
        }

        return () => {
            processor.abort()
        }
    }, [database, itemProcessor, dataVersion, query])

    return state
}
