import type { IndexEntry } from "./types"

interface BaseFilter {
    id: string
    type: "text" | "category"
}

export interface TextFilter extends BaseFilter {
    type: "text"
    query: string
    caseSensitive: boolean
    regex: boolean
}

export const categories = ["all", "frame", "text", "component", "color-style", "text-style"] as const

export interface CategoryFilter extends BaseFilter {
    type: "category"
    category: "all" | IndexEntry["type"]
}

export type Filter = TextFilter | CategoryFilter

export function isTextFilter(filter: Filter | undefined): filter is TextFilter {
    return typeof filter !== "undefined" && filter.type === "text"
}

export function isCategoryFilter(filter: Filter | undefined): filter is CategoryFilter {
    return typeof filter !== "undefined" && filter.type === "category"
}
