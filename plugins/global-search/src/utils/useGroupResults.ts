import { startTransition, useEffect, useRef, useState } from "react"
import { type EntryResult, groupResults } from "./filter/group-results"
import type { Result } from "./filter/types"

export function useGroupResults(results: readonly Result[]): readonly EntryResult[] {
    const abortControllerRef = useRef<AbortController | null>(null)
    const [groupedResults, setGroupedResults] = useState<readonly EntryResult[]>([])
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        abortControllerRef.current?.abort()

        const abortController = new AbortController()
        abortControllerRef.current = abortController

        void groupResults(results, abortController.signal)
            .then((results: readonly EntryResult[]) => {
                if (abortController.signal.aborted) return
                startTransition(() => {
                    setGroupedResults(results)
                })
            })
            .catch((error: unknown) => {
                if (abortController.signal.aborted) return
                setError(error instanceof Error ? error : new Error(String(error), { cause: error }))
            })

        return () => {
            abortController.abort()
            startTransition(() => {
                setGroupedResults([])
            })
        }
    }, [results])

    if (error) {
        throw error
    }

    return groupedResults
}
