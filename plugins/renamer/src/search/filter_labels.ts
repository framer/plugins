import * as text from "../utils/text"
import type { CategoryFilter } from "./filters"

export function getCategoryFilterLabel(filter: CategoryFilter): string {
    return text.capitalize(filter.category).replaceAll("-", " ")
}
