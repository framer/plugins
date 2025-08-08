import { useEffect, useMemo, useState } from "react"
import { IndexerContext } from "./context"
import type { IndexerEvents } from "./indexer"
import { GlobalSearchIndexer } from "./indexer"
import type { IndexEntry } from "./types"

/**
 * Creates an indexer instance and provides it to the children.
 * Manages the index in a React state, so that it can use reactivity to show the results
 */
export function IndexerProvider({ children }: { children: React.ReactNode }) {
    const indexer = useMemo(() => new GlobalSearchIndexer(), [])
    const [isIndexing, setIsIndexing] = useState(false)
    const [index, setIndex] = useState<Record<string, IndexEntry>>({})

    useEffect(() => {
        indexer.start()

        const onUpsert = ({ entry }: IndexerEvents["upsert"]) => {
            setIndex(prev => ({ ...prev, [entry.id]: entry }))
        }

        const onStarted = () => {
            setIndex({})
            setIsIndexing(true)
        }

        const onCompleted = () => {
            setIsIndexing(false)
        }

        const onError = ({ error }: Events["error"]) => {
            setIsIndexing(false)
            setIndex({})
            console.error(error)
        }

        const unsubscribeUpsert = indexer.on("upsert", onUpsert)
        const unsubscribeStarted = indexer.on("started", onStarted)
        const unsubscribeCompleted = indexer.on("completed", onCompleted)
        const unsubscribeError = indexer.on("error", onError)

        return () => {
            unsubscribeUpsert()
            unsubscribeStarted()
            unsubscribeCompleted()
            unsubscribeError()
        }
    }, [indexer])

    const data = useMemo(
        () => ({ isIndexing, index: Object.values(index), indexerInstance: indexer }),
        [isIndexing, index, indexer]
    )

    return <IndexerContext.Provider value={data}>{children}</IndexerContext.Provider>
}
