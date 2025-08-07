import { createContext } from "react"
import { GlobalSearchIndexer } from "./indexer"
import type { IndexEntry } from "./types"

export const IndexerContext = createContext<{
    isIndexing: boolean
    index: readonly IndexEntry[]
    indexerInstance: GlobalSearchIndexer
} | null>(null)
