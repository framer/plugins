import { framer, type MenuItem } from "framer-plugin"
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import { FocusScope } from "react-aria"
import { cn } from "../utils/className"
import { compareRootNodeTypeByPriority } from "../utils/filter/group-results"
import { useAsyncFilter } from "../utils/filter/useAsyncFilter"
import type { RootNodeType } from "../utils/indexer/types"
import { useIndexer } from "../utils/indexer/useIndexer"
import { entries } from "../utils/object"
import { getPluginUiOptions } from "../utils/plugin-ui"
import { useDebounceValue } from "../utils/useDebounceValue"
import { useMinimumDuration } from "../utils/useMinimumDuration"
import { ResultMessage } from "./ResultMessage"
import { ResultsList } from "./Results"
import { SearchInput } from "./SearchInput"
import { IconEllipsis } from "./ui/IconEllipsis"
import { Menu } from "./ui/Menu"

export function SearchScene() {
    const { isIndexing, db, dataVersion, hasCompletedInitialIndex } = useIndexer()
    const [query, setQuery] = useState("")
    const { searchOptions, optionsMenuItems } = useOptionsMenuItems()
    const deferredQuery = useDeferredValue(query)
    const isInitialIndexing = isIndexing && !hasCompletedInitialIndex
    const isIndexingWithMinimumDuration = useMinimumDuration(isInitialIndexing, 250)
    const debouncedQuery = useDebounceValue(deferredQuery, 250)
    // if the query is shorter than 3 characters, we use the deferred query to avoid rendering long lists when the user is typing
    const queryToUse = deferredQuery.length <= 3 ? debouncedQuery : deferredQuery

    const {
        results,
        running: isFilterRunning,
        error: filterError,
    } = useAsyncFilter(queryToUse, searchOptions, db, dataVersion)

    const hasResults = results.length > 0

    if (filterError) {
        console.error(filterError)
        throw filterError
    }

    const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value)
    }, [])

    useEffect(() => {
        void framer.showUI(
            getPluginUiOptions({ query: queryToUse, hasResults, areResultsFinal: !isIndexing && !isFilterRunning })
        )
    }, [queryToUse, hasResults, isFilterRunning, isIndexing])

    return (
        <main className="flex flex-col h-full">
            <FocusScope>
                <div
                    className={cn(
                        "flex gap-2 border-divider-light dark:border-divider-dark border-y py-3 mx-3 transition-colors items-center",
                        !queryToUse && "border-b-transparent dark:border-b-transparent"
                    )}
                >
                    <SearchInput value={query} onChange={handleQueryChange} />

                    <div
                        title="Indexing..."
                        className="aria-hidden:opacity-0 transition flex items-center justify-center"
                        aria-hidden={!isIndexingWithMinimumDuration}
                    >
                        <div className="framer-spinner bg-black dark:bg-white animate-[spin_0.8s_linear_infinite]"></div>
                    </div>

                    <Menu items={optionsMenuItems}>
                        <IconEllipsis className="text-framer-text-tertiary-light dark:text-framer-text-tertiary-dark" />
                    </Menu>
                </div>
                <div className="overflow-y-auto px-3 flex flex-col flex-1 scrollbar-hidden">
                    {queryToUse && hasResults && <ResultsList groups={results} />}
                    {queryToUse &&
                        !hasResults &&
                        (isIndexing ? (
                            <ResultMessage>Searching…</ResultMessage>
                        ) : (
                            <ResultMessage>No Results</ResultMessage>
                        ))}
                </div>
            </FocusScope>
        </main>
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
    CodeFile: true,
}

const defaultSearchOptions = entries(optionsEnabled)
    .filter(([, enabled]) => enabled)
    .map(([rootNode]) => rootNode)

const optionsMenuLabels = {
    ComponentNode: "Components",
    WebPageNode: "Pages",
    Collection: "Collections",
    CodeFile: "Code",
} as const satisfies Record<RootNodeType, string>

const sortedRootNodeTypes = entries(optionsEnabled).sort(([a], [b]) => compareRootNodeTypeByPriority(a, b))

function useOptionsMenuItems() {
    const [searchOptions, setSearchOptions] = useState<readonly RootNodeType[]>(defaultSearchOptions)

    const optionsMenuItems = useMemo((): MenuItem[] => {
        return sortedRootNodeTypes.map(([rootNode, enabled]) => ({
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
