# Renamer / Find & Replace

This plugin is used for both the Renamer and Find & Replace plugins. This is because both use the same filtering logic and have very similar UIs.

## Setup

Install the dependencies.

```sh
npm i
```

Both plugins share the same code base, but are run and built separately.

```sh
# Running the plugins.
npm run dev:renamer
npm run dev:find_and_replace

# building the plugins.
npm run build:renamer
npm run build:find_and_replace
```

## Architecture

Both plugins use a search engine that indexes and filters Framer nodes, this is found in `./shared/search` It's framework agnostic, so it's just vanilla JS and not specific to Svelte. Though since Svelte converts objects to Proxy objects, state changes just work.

### Filters

Multiple filters can be used to exclude nodes from the search results. They have settings which are defined in `./shared/search/filters.ts` with their implementations found in `./shared/search/execute_filters.ts`.

```ts
// An example of a text filter definition.
export interface TextFilter extends BaseFilter {
  type: "text";
  query: string;
  caseSensitive: boolean;
  regex: boolean;
}

// And the text filters implementation.
function executeTextFilter(filter: TextFilter, entry: IndexEntry): FilterResult {
  const text = entry.text ?? entry.name;
  // Remove entry from the search results.
  if (!text) return false;

  const ranges = findRanges(text, filter.query, filter.caseSensitive, filter.regex);
  // Remove entry from the search results.
  if (!ranges.length) return false;

  // Include entry in the search results.
  return {
    id: entry.id,
    title: text,
    ranges,
    entry,
  };
}
```

### Processing

Result processors found in `./shared/search/result_processors` are used to perform actions on the search result nodes. For example, renaming them.

Processing results is done in batches to keep the plugin performant and to have the ability to track the progress.
