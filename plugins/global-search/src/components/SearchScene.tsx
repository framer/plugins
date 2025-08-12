import { framer, type MenuItem } from "framer-plugin"
import { startTransition, useCallback, useEffect, useMemo, useState } from "react"
import { assertNever } from "../utils/assert"
import { cn } from "../utils/className"
import { type ReadonlyGroupedResults } from "../utils/filter/group-results"
import type { Range } from "../utils/filter/ranges"
import { type CollectionItemResult, type NodeResult, type Result } from "../utils/filter/types"
import { useFilter } from "../utils/filter/useFilter"
import type { RootNodeType } from "../utils/indexer/types"
import { useIndexer } from "../utils/indexer/useIndexer"
import { entries } from "../utils/object"
import { SearchInput } from "./SearchInput"
import { IconEllipsis } from "./ui/IconEllipsis"
import { Menu } from "./ui/Menu"

export function SearchScene() {
    const { index } = useIndexer()
    const [query, setQuery] = useState("")
    const { searchOptions, optionsMenuItems } = useOptionsMenuItems()
    const { results } = useFilter(query, searchOptions, index)

    const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        startTransition(() => {
            setQuery(event.target.value)
        })
    }, [])

    const hasResults = useMemo(
        () =>
            Object.values(results).some(resultForRootNodeType =>
                Object.values(resultForRootNodeType).some(resultsForRootId => resultsForRootId.length > 0)
            ),
        [results]
    )

    useEffect(() => {
        if (query && hasResults) {
            framer.showUI({
                height: 320,
            })
        } else if (query && !hasResults) {
            framer.showUI({
                height: 140,
            })
        } else {
            framer.showUI({
                height: 50,
            })
        }
    }, [query, hasResults])

    return (
        <main className="flex flex-col h-full">
            <div
                className={cn(
                    "flex gap-2 border-divider-light dark:border-divider-dark border-y py-3 mx-3 transition-colors",
                    !query && "border-b-transparent dark:border-b-transparent"
                )}
            >
                <SearchInput value={query} onChange={handleQueryChange} />
                <Menu items={optionsMenuItems}>
                    <IconEllipsis className="text-framer-text-tertiary-light dark:text-framer-text-tertiary-dark" />
                </Menu>
            </div>
            <div className="flex-1 overflow-y-auto px-4 flex flex-col">
                {query && hasResults && <SearchResultsByRootType results={results} />}
                {query && !hasResults && <NoResults />}
            </div>
        </main>
    )
}

// All components below this line are temporary and will be removed when the search results are implemented
// Having them ensures it's easier to verify the indexer and filterer are working as expected

function NoResults() {
    return (
        <div className="flex-1 flex justify-center items-center">
            <div className="text-center text-amber-500">No results found.</div>
        </div>
    )
}

function SearchResultsByRootType({ results }: { results: ReadonlyGroupedResults }) {
    return Object.entries(results).map(([rootNodeType, resultsByRootId]) => (
        <RootNodeTypeSection key={rootNodeType} resultsByRootId={resultsByRootId} />
    ))
}

function RootNodeTypeSection({ resultsByRootId }: { resultsByRootId: { readonly [id: string]: readonly Result[] } }) {
    return (
        <div className="flex flex-col gap-2 mb-4 text-amber-500">
            {Object.entries(resultsByRootId).map(([rootNodeId, results]) => (
                <SearchResultGroup key={rootNodeId} results={results} />
            ))}
        </div>
    )
}

function SearchResultGroup({ results }: { results: readonly Result[] }) {
    const [first] = results

    if (!first) return null

    return (
        <div>
            <div className="text-lg text-amber-800">
                {first.entry.rootNodeName} ({first.entry.rootNodeType} {first.entry.rootNode.id})
            </div>
            <ul className="flex flex-col gap-2">
                {results.map(result => (
                    <SearchResult key={result.id} result={result} />
                ))}
            </ul>
        </div>
    )
}

function SearchResult({ result }: { result: Result }) {
    if (result.type === "CollectionItem") {
        return <CollectionItemSearchResult result={result} />
    } else if (result.type === "Node") {
        return <NodeSearchResult result={result} />
    }

    assertNever(result)
}

function NodeSearchResult({ result }: { result: NodeResult }) {
    if (!result.entry.text) return null

    return <SearchResultRanges text={result.entry.text} ranges={result.ranges} resultId={result.id} />
}

function CollectionItemSearchResult({ result }: { result: CollectionItemResult }) {
    if (!result.text) return null

    return <SearchResultRanges text={result.text} ranges={result.ranges} resultId={result.id} />
}

function SearchResultRanges({ text, ranges, resultId }: { text: string; ranges: readonly Range[]; resultId: string }) {
    return ranges.map(range => (
        <li key={`${resultId}-${range.join("-")}`} className="text-ellipsis overflow-hidden whitespace-nowrap">
            <HighlightedTextWithContext text={text} range={range} /> ({resultId})
        </li>
    ))
}

function HighlightedTextWithContext({ text, range }: { text: string; range: Range }) {
    const [start, end] = range
    const before = text.slice(0, start)
    const match = text.slice(start, end)
    const after = text.slice(end)

    return (
        <>
            {before}
            <span className="font-bold">{match}</span>
            {after}
        </>
    )
}

/**
 * Contains if you can filter by a root node type.
 *
 * During current state of the plugin, not all types are indexed yet.
 */
const optionsEnabled = {
    ComponentNode: true,
    WebPageNode: true,
    Collection: true,
} as const satisfies Record<RootNodeType, boolean>

const defaultSearchOptions = entries(optionsEnabled)
    .filter(([, enabled]) => enabled)
    .map(([rootNode]) => rootNode)

const optionsMenuLabels = {
    ComponentNode: "Components",
    WebPageNode: "Pages",
    Collection: "Collections",
} as const satisfies Record<RootNodeType, string>

function useOptionsMenuItems() {
    const [searchOptions, setSearchOptions] = useState<readonly RootNodeType[]>(defaultSearchOptions)

    const optionsMenuItems = useMemo((): MenuItem[] => {
        return entries(optionsEnabled).map(([rootNode, enabled]) => ({
            id: rootNode,
            label: optionsMenuLabels[rootNode],
            enabled,
            checked: searchOptions.includes(rootNode),
            onAction: () => {
                setSearchOptions(prev => {
                    if (prev.includes(rootNode)) {
                        return prev.filter(option => option !== rootNode)
                    }

                    return [...prev, rootNode]
                })
            },
        }))
    }, [searchOptions])

    return { searchOptions, optionsMenuItems }
}
