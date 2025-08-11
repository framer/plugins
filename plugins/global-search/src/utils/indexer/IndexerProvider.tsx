import { startTransition, useEffect, useMemo, useRef, useState } from "react"
import { IndexerContext } from "./context"
import type { IndexerEvents } from "./indexer"
import { GlobalSearchIndexer } from "./indexer"
import type { IndexEntry } from "./types"

/**
 * Creates an indexer instance and provides it to the children.
 * Manages the index in a React state, so that it can use reactivity to show the results
 */
export function IndexerProvider({ children }: { children: React.ReactNode }) {
    const indexerRef = useRef<GlobalSearchIndexer>()
    if (!indexerRef.current) {
        indexerRef.current = new GlobalSearchIndexer()
    }
    const indexer = indexerRef.current
    const [isIndexing, setIsIndexing] = useState(false)
    const [index, setIndex] = useState<Record<string, IndexEntry>>({})

    useEffect(() => {
        indexer.start()

        const onUpsert = ({ entry }: IndexerEvents["upsert"]) =>
            startTransition(() => {
                setIndex(prev => ({ ...prev, [entry.id]: entry }))
            })

        const onStarted = () =>
            startTransition(() => {
                setIndex({})
                setIsIndexing(true)
            })

        const onCompleted = () =>
            startTransition(() => {
                setIsIndexing(false)
            })

        const onAborted = () =>
            startTransition(() => {
                setIsIndexing(false)
            })

        const onError = ({ error }: IndexerEvents["error"]) =>
            startTransition(() => {
                setIsIndexing(false)
                setIndex({})
                console.error(error)
            })

        const onRestarted = () =>
            startTransition(() => {
                setIsIndexing(true)
            })

        const unsubscribes = [
            indexer.on("upsert", onUpsert),
            indexer.on("restarted", onRestarted),
            indexer.on("aborted", onAborted),
            indexer.on("started", onStarted),
            indexer.on("completed", onCompleted),
            indexer.on("error", onError),
        ]

        return () => {
            for (const unsubscribe of unsubscribes) unsubscribe()
        }
    }, [indexer])

    const data = useMemo(
        () => ({ isIndexing, index: Object.values(index), indexerInstance: indexer }),
        [isIndexing, index, indexer]
    )

    return <IndexerContext.Provider value={data}>{children}</IndexerContext.Provider>
}
