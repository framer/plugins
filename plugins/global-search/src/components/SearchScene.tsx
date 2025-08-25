import { framer, type MenuItem } from "framer-plugin"
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import { cn } from "../utils/className"
import { useAsyncFilter } from "../utils/filter/useAsyncFilter"
import type { RootNodeType } from "../utils/indexer/types"
import { useIndexer } from "../utils/indexer/useIndexer"
import { entries } from "../utils/object"
import { getPluginUiOptions } from "../utils/plugin-ui"
import { NoResults } from "./NoResults"
import { ResultsList } from "./Results"
import { SearchInput } from "./SearchInput"
import { IconEllipsis } from "./ui/IconEllipsis"
import { IconSpinner } from "./ui/IconSpinner"
import { Menu } from "./ui/Menu"

export function SearchScene() {
    const { isIndexing, db, dataVersion } = useIndexer()
    const [query, setQuery] = useState("")
    const { searchOptions, optionsMenuItems } = useOptionsMenuItems()
    const deferredQuery = useDeferredValue(query)

    const { results, hasResults, error: filterError } = useAsyncFilter(deferredQuery, searchOptions, db, dataVersion)

    if (filterError) {
        console.error(filterError)
        throw filterError
    }

    const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value)
    }, [])

    useEffect(() => {
        void framer.showUI(getPluginUiOptions({ query: deferredQuery, hasResults, areResultsFinal: !isIndexing }))
    }, [deferredQuery, hasResults, isIndexing])

    return (
        <main className="flex flex-col h-full">
            <div
                className={cn(
                    "flex gap-2 border-divider-light dark:border-divider-dark border-y py-3 mx-3 transition-colors items-center",
                    !deferredQuery && "border-b-transparent dark:border-b-transparent"
                )}
            >
                <SearchInput value={query} onChange={handleQueryChange} />
                {isIndexing && (
                    // TODO: Discuss if we should add a tooltip to explain what's this.
                    <span
                        title="Indexing..."
                        className="animate-[fade-in_150ms_forwards] [animation-delay:500ms] opacity-0"
                    >
                        <IconSpinner className="text-black dark:text-white animate-[spin_0.8s_linear_infinite]" />
                    </span>
                )}
                <Menu items={optionsMenuItems}>
                    <IconEllipsis className="text-framer-text-tertiary-light dark:text-framer-text-tertiary-dark" />
                </Menu>
            </div>
            <div className="overflow-y-auto px-3 flex flex-col flex-1">
                {deferredQuery && hasResults && <ResultsList groupedResults={results} />}
                {deferredQuery && !hasResults && !isIndexing && <NoResults />}
            </div>
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
}

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
