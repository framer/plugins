import { framer } from "framer-plugin"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import starsDarkImage from "./assets/stars_dark.png"
import starsLightImage from "./assets/stars_light.png"
import Results from "./components/Results.tsx"
import SearchReplace from "./components/SearchReplace.tsx"
import Tabs from "./components/Tabs.tsx"
import { BatchProcessResults } from "./search/batch_process_results"
import { executeFilters } from "./search/execute_filters"
import type { CategoryFilter, Filter, TextFilter } from "./search/filters"
import { Indexer } from "./search/indexer"
import { cleanUpResult } from "./search/result_processors/clean_up_result"
import { renameResult } from "./search/result_processors/rename_result"
import type { CanvasNode, IndexEntry, Result } from "./search/types"
import { assertNever } from "./utils/assert"
import "./App.css"

void framer.showUI({
    position: "top right",
    width: 260,
    height: 450,
    minWidth: 260,
    minHeight: 450,
    resizable: true,
})

export function App() {
    const [isAllowedToSetAttributes, setIsAllowedToSetAttributes] = useState(framer.isAllowedTo("Node.setAttributes"))
    const [currentRootId, setCurrentRootId] = useState<string>()
    const [currentMode, setCurrentMode] = useState<"search" | "clean">("search")
    const [indexing, setIndexing] = useState(false)
    const [replacing, setReplacing] = useState(false)
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
    const [index, setIndex] = useState<Record<string, IndexEntry>>({})
    const [textSearchFilter, setTextSearchFilter] = useState<TextFilter>({
        id: "text-search",
        type: "text",
        query: "",
        caseSensitive: false,
        regex: false,
    })
    const [categoryFilter] = useState<CategoryFilter>({
        id: "category",
        type: "category",
        category: "all",
    })
    const [replacement, setReplacement] = useState("")

    const filters: Filter[] = useMemo(() => [textSearchFilter, categoryFilter], [textSearchFilter, categoryFilter])
    const entries: IndexEntry[] = useMemo(() => Object.values(index), [index])
    const results: Result[] = useMemo(() => executeFilters(filters, entries), [filters, entries])

    const resultsRenamerRef = useRef<BatchProcessResults | null>(null)
    const replacementRef = useRef(replacement)

    const indexer = useMemo(
        () =>
            new Indexer({
                scope: "page",
                includedNodeTypes: ["FrameNode", "SVGNode", "ComponentInstanceNode", "TextNode", "VectorSetItemNode"],
                includedAttributes: [],

                onRestarted: () => {
                    setIndex({})
                    setIndexing(false)
                },

                onStarted: () => {
                    setIndexing(true)
                    resultsRenamerRef.current?.setReady(false)
                },

                onUpsert: entry => {
                    setIndex(prev => ({ ...prev, [entry.id]: entry }))
                },

                onCompleted: () => {
                    setIndexing(false)
                    resultsRenamerRef.current?.setReady(true)
                },
            }),
        []
    )

    const resultsRenamer = useMemo(() => {
        const instance = new BatchProcessResults({
            process: async (result: Result, node: CanvasNode) => {
                switch (currentMode) {
                    case "search":
                        await node.setAttributes({
                            name: renameResult(result, replacementRef.current),
                        })
                        return

                    case "clean":
                        await node.setAttributes({
                            name: cleanUpResult(result),
                        })
                        return

                    default:
                        assertNever(currentMode)
                }
            },

            onStarted: () => {
                setReplacing(true)
            },

            onCompleted: () => {
                setReplacing(false)
                void indexer.restart()
            },
        })

        resultsRenamerRef.current = instance
        return instance
    }, [currentMode, indexer])

    const renameResults = useCallback(() => {
        if (!isAllowedToSetAttributes) return
        void resultsRenamer.start(results)
    }, [isAllowedToSetAttributes, resultsRenamer, results])

    const throttle = useCallback((callback: () => void, delay = 1000) => {
        let timeout: ReturnType<typeof setTimeout> | null = null

        return () => {
            if (timeout) return

            timeout = setTimeout(() => {
                callback()
                timeout = null
            }, delay)
        }
    }, [])

    const throttledStartIndexer = useMemo(
        () =>
            throttle(() => {
                void indexer.restart()
            }),
        [throttle, indexer]
    )

    // Subscribe to permissions
    useEffect(() => {
        const unsubscribe = framer.subscribeToIsAllowedTo("Node.setAttributes", newIsAllowed => {
            setIsAllowedToSetAttributes(newIsAllowed)
        })

        return unsubscribe
    }, [])

    // Subscribe to selection
    useEffect(() => {
        return framer.subscribeToSelection(selection => {
            setSelectedNodeIds(selection.map(node => node.id))
        })
    }, [])

    // Restart indexer when root changes
    useEffect(() => {
        void indexer.restart()
    }, [currentRootId, indexer])

    // Subscribe to canvas root
    useEffect(() => {
        setIndex({})
        void indexer.start()

        return framer.subscribeToCanvasRoot(root => {
            setCurrentRootId(root.id)

            if (replacing) return

            throttledStartIndexer()
        })
    }, [indexer, replacing, throttledStartIndexer])

    const tabItems = [
        {
            label: "Search",
            active: currentMode === "search",
            select: () => {
                setCurrentMode("search")
            },
        },
        {
            label: "Clean",
            active: currentMode === "clean",
            select: () => {
                setCurrentMode("clean")
            },
        },
    ]

    const getTextAfterRename = useCallback(
        (result: Result) => {
            switch (currentMode) {
                case "search":
                    return renameResult(result, replacement)

                case "clean":
                    return cleanUpResult(result)

                default:
                    assertNever(currentMode)
            }
        },
        [currentMode, replacement]
    )

    const setReplacementValue = (value: string) => {
        setReplacement(value)
        replacementRef.current = value
    }

    return (
        <div className="app">
            <Tabs items={tabItems} />

            <div className="results">
                {!textSearchFilter.query ? (
                    <div className="empty-state">
                        <img className="light" src={starsLightImage} alt="Stars" draggable={false} />
                        <img className="dark" src={starsDarkImage} alt="Stars" draggable={false} />
                    </div>
                ) : (
                    <div className="list">
                        <Results
                            query={textSearchFilter.query}
                            selectedNodeIds={selectedNodeIds}
                            indexing={indexing}
                            results={results}
                            getTextAfterRename={getTextAfterRename}
                        />
                    </div>
                )}
            </div>

            <SearchReplace
                query={textSearchFilter.query}
                setQuery={(query: string) => {
                    setTextSearchFilter(prev => ({ ...prev, query }))
                }}
                replacement={replacement}
                setReplacement={setReplacementValue}
                loading={replacing}
                disableAction={currentMode === "search" && !replacement}
                isAllowed={isAllowedToSetAttributes}
                showReplacement={currentMode === "search"}
                actionLabel={currentMode === "search" ? "Rename" : "Clean Up"}
                onRenameClick={renameResults}
            />
        </div>
    )
}
