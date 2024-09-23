import type { CategoryFilter, Filter, TextFilter } from "./filters";
import type { IndexEntry, Result } from "./types";

import { findRanges } from "../utils/text";
import { assertNever } from "../utils/assert";

type FilterResult = Result | boolean;

function executeTextFilter(filter: TextFilter, entry: IndexEntry): FilterResult {
  const text = entry.text ?? entry.name;
  if (!text) return false;

  const ranges = findRanges(text, filter.query, filter.caseSensitive, filter.regex);
  if (!ranges.length) return false;

  return {
    id: entry.id,
    title: text,
    ranges,
    entry,
  };
}

function executeCategoryFilter(filter: CategoryFilter, entry: IndexEntry): FilterResult {
  if (filter.category === "all") {
    return true;
  }

  return filter.category === entry.type;
}

function executeFilter(filter: Filter, entry: IndexEntry): FilterResult {
  switch (filter.type) {
    case "text":
      return executeTextFilter(filter, entry);

    case "category":
      return executeCategoryFilter(filter, entry);

    default:
      assertNever(filter);
  }
}

export function executeFilters(filters: Filter[], index: IndexEntry[]) {
  const results: Result[] = [];

  for (const entry of index) {
    let include: boolean = true;
    let result: Result | undefined;

    for (const filter of filters) {
      const filterResult = executeFilter(filter, entry);

      if (typeof filterResult !== "boolean") {
        result = filterResult;
      }

      if (filterResult === false) {
        include = false;
        break;
      }
    }

    if (include && result) {
      results.push(result);
    }
  }

  return results;
}
