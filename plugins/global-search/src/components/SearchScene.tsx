import { framer, type MenuItem } from "framer-plugin"
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import { cn } from "../utils/className"
import { compareRootNodeTypeByPriority, type PreparedGroup } from "../utils/filter/group-results"
import { AsyncFilterStatus, useAsyncFilter } from "../utils/filter/useAsyncFilter"
import type { RootNodeType } from "../utils/indexer/types"
import { useIndexer } from "../utils/indexer/useIndexer"
import { entries } from "../utils/object"
import { getPluginUiOptions } from "../utils/plugin-ui"
import { SelectionProvider } from "../utils/selection/SelectionProvider"
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

    const inputIdleDelayPassed = useIdleDelayPassed(deferredQuery)

    const {
        results,
        status: filterStatus,
        error: filterError,
    } = useAsyncFilter(
        deferredQuery,
        searchOptions,
        db,
        isInitialIndexing ? { restartOnVersionChange: true, dataVersion } : { restartOnVersionChange: false }
    )
    const isFiltererRunning = filterStatus === AsyncFilterStatus.Running
    const showFiltererIndicator = isFiltererRunning && inputIdleDelayPassed
    const showSpinner = !!deferredQuery && (isInitialIndexing || showFiltererIndicator)

    const hasResults = results.length > 0
    const { showNoResults } = useNoResults({
        query: deferredQuery,
        results,
        status: filterStatus,
    })

    if (filterError) {
        console.error(filterError)
        throw filterError
    }

    const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value)
    }, [])

    useEffect(() => {
        void framer.showUI(
            getPluginUiOptions({
                query: deferredQuery,
                hasResults: hasResults,
                withMessage: showNoResults,
            })
        )
    }, [deferredQuery, hasResults, showNoResults])

    return (
        <main className="flex flex-col h-full">
            <SelectionProvider>
                <div
                    className={cn(
                        "flex z-10 gap-2 border-divider-light dark:border-divider-dark border-y py-3 mx-3 transition-colors items-center bg-modal-light dark:bg-modal-dark",
                        !deferredQuery && "border-b-transparent dark:border-b-transparent"
                    )}
                >
                    <SearchInput value={query} onChange={handleQueryChange} />

                    <div
                        title="Searching…"
                        className="aria-hidden:opacity-0 transition-opacity flex items-center justify-center"
                        aria-hidden={!showSpinner}
                    >
                        <div className="framer-spinner bg-black dark:bg-white animate-[spin_0.8s_linear_infinite]"></div>
                    </div>

                    <Menu items={optionsMenuItems}>
                        <IconEllipsis className="text-framer-text-tertiary-light dark:text-framer-text-tertiary-dark" />
                    </Menu>
                </div>
                <div className="px-3 flex flex-col flex-1 scrollbar-hidden">
                    {hasResults && <ResultsList groups={results} />}
                    {showNoResults && <ResultMessage>No Search Results</ResultMessage>}
                </div>
            </SelectionProvider>
        </main>
    )
}

const searchOptions: Record<RootNodeType, true> = {
    ComponentNode: true,
    WebPageNode: true,
    Collection: true,
    CodeFile: true,
    DesignPageNode: true,
}

const defaultSearchOptions = entries(searchOptions).map(([rootNode]) => rootNode)

const optionsMenuLabels = {
    ComponentNode: "Components",
    WebPageNode: "Pages",
    DesignPageNode: "Designs",
    Collection: "Collections",
    CodeFile: "Code",
} as const satisfies Record<RootNodeType, string>

const sortedRootNodeTypes = entries(searchOptions).sort(([a], [b]) => compareRootNodeTypeByPriority(a, b))

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

/**
 * Debounces the "no search results" visibility based on the previous state
 */
function useNoResults({
    query,
    results,
    status,
}: {
    readonly query: string
    readonly results: readonly PreparedGroup[]
    readonly status: AsyncFilterStatus
}): {
    readonly showNoResults: boolean
} {
    const [showNoResults, setShowNoResults] = useState(false)

    useEffect(() => {
        if (query.length === 0 || results.length > 0) {
            setShowNoResults(false)
        } else if (status === AsyncFilterStatus.Completed) {
            setShowNoResults(true)
        }
    }, [query, results, status])

    return { showNoResults }
}

function useIdleDelayPassed(query: string) {
    const [idleDelayPassed, setIdleDelayPassed] = useState(false)

    useEffect(() => {
        setIdleDelayPassed(false)
        const id = setTimeout(() => {
            setIdleDelayPassed(true)
        }, 500)
        return () => {
            clearTimeout(id)
        }
    }, [query])

    return idleDelayPassed
}
