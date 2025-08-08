import { useContext } from "react"
import { IndexerContext } from "./context"

export function useIndexer() {
    const context = useContext(IndexerContext)

    if (!context) {
        throw new Error("useIndexer must be used within a IndexerProvider")
    }

    return context
}
