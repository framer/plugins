import { createContext } from "react"

export const ResizeContext = createContext<((height: "short" | "long") => void) | null>(null)
