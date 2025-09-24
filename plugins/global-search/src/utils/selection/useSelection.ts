import { useContext } from "react"
import { SelectionContext } from "./context"

export function useSelection() {
    const ctx = useContext(SelectionContext)
    if (!ctx) throw new Error("useSelection must be used within SelectionProvider")
    return ctx
}
