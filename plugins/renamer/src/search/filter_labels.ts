import type { CategoryFilter } from "./filters";

import * as text from "../utils/text";

export function getCategoryFilterLabel(filter: CategoryFilter): string {
  return `${text.capitalize(filter.category).replaceAll("-", " ")}`;
}
