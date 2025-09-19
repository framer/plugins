import { createContext } from "react"
import type { GlobalSearchDatabase } from "../db"
import { GlobalSearchIndexer } from "./indexer"

export const IndexerContext = createContext<{
    isIndexing: boolean
    indexerInstance: GlobalSearchIndexer
    db: GlobalSearchDatabase
    dataVersion: number
    hasCompletedInitialIndex: boolean
} | null>(null)
