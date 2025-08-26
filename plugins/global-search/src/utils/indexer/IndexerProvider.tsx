import { startTransition, useEffect, useMemo, useRef, useState } from "react"
import { GlobalSearchDatabase } from "../db"
import { IndexerContext } from "./context"
import type { IndexerEvents } from "./indexer"
import { GlobalSearchIndexer } from "./indexer"

/**
 * Creates database and indexer instances and provides them to the children.
 * The database manages its own version and the indexer depends on the database.
 */
export function IndexerProvider({ children, projectId }: { children: React.ReactNode; projectId: string }) {
    const dbRef = useRef<GlobalSearchDatabase>()
    dbRef.current ??= new GlobalSearchDatabase(projectId)
    const db = dbRef.current

    const indexerRef = useRef<GlobalSearchIndexer>()
    indexerRef.current ??= new GlobalSearchIndexer(db)
    const indexer = indexerRef.current

    const [isIndexing, setIsIndexing] = useState(false)
    const [dataVersion, setDataVersion] = useState(0)

    useEffect(() => {
        const onProgress = () => {
            startTransition(() => {
                setDataVersion(prev => prev + 1)
            })
        }
        const onStarted = () => {
            startTransition(() => {
                setIsIndexing(true)
            })
        }

        const onCompleted = () => {
            startTransition(() => {
                setIsIndexing(false)
                setDataVersion(prev => prev + 1)
            })
        }

        const onAborted = () => {
            startTransition(() => {
                setIsIndexing(false)
            })
        }

        const onError = ({ error }: IndexerEvents["error"]) => {
            startTransition(() => {
                setIsIndexing(false)
                console.error(error)
            })
        }

        const onRestarted = () => {
            startTransition(() => {
                setIsIndexing(true)
            })
        }

        const unsubscribes = [
            indexer.on("progress", onProgress),
            indexer.on("restarted", onRestarted),
            indexer.on("aborted", onAborted),
            indexer.on("started", onStarted),
            indexer.on("completed", onCompleted),
            indexer.on("error", onError),
        ]

        void indexer.start()

        return () => {
            for (const unsubscribe of unsubscribes) unsubscribe()
        }
    }, [indexer, db])

    const data = useMemo(
        () => ({ isIndexing, indexerInstance: indexer, db, dataVersion }),
        [isIndexing, indexer, db, dataVersion]
    )

    return <IndexerContext.Provider value={data}>{children}</IndexerContext.Provider>
}
