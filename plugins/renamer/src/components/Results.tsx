import cx from "classnames"
import { framer } from "framer-plugin"
import { useEffect, useMemo, useRef, useState } from "react"

import type { Result } from "../search/types"
import LayerIcon from "./LayerIcon"
import PlaceholderRenameComparison from "./PlaceholderRenameComparison"
import RenameComparison from "./RenameComparison"

interface Props {
    query: string
    indexing: boolean
    results: Result[]
    selectedNodeIds: string[]
    getTextAfterRename: (result: Result) => string
}

const ITEM_HEIGHT = 30
const PAGE_SIZE = 10
const BUFFER_SIZE = 5

export default function Results({ query, indexing, results, selectedNodeIds, getTextAfterRename }: Props) {
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const [showTopGradient, setShowTopGradient] = useState(false)
    const [showBottomGradient, setShowBottomGradient] = useState(false)
    const [scrollTop, setScrollTop] = useState(0)
    const [containerHeight, setContainerHeight] = useState(0)
    const [isScrollable, setIsScrollable] = useState(false)

    const focusResult = async (result: Result) => {
        await framer.setSelection(result.id)
        await framer.zoomIntoView(result.id, { maxZoom: 1 })
    }

    // Reset scroll position when query changes
    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = 0
            setScrollTop(0)
        }
    }, [query])

    // Calculate virtual list range
    const { startIndex, endIndex } = useMemo(() => {
        const visibleItemCount = Math.ceil(containerHeight / ITEM_HEIGHT)

        // Calculate the range of items that should be visible based on container height
        const visibleStartIndex = Math.floor(scrollTop / ITEM_HEIGHT)
        const visibleEndIndex = Math.min(results.length, visibleStartIndex + visibleItemCount)

        // Add buffer items above and below the visible range
        const rawStartIndex = Math.max(0, visibleStartIndex - BUFFER_SIZE)
        const rawEndIndex = Math.min(results.length, visibleEndIndex + BUFFER_SIZE)

        // Snap to multiples of PAGE_SIZE
        const startIndex = Math.floor(rawStartIndex / PAGE_SIZE) * PAGE_SIZE
        const endIndex = Math.min(results.length, Math.ceil(rawEndIndex / PAGE_SIZE) * PAGE_SIZE)

        return { startIndex, endIndex }
    }, [results, scrollTop, containerHeight])

    const visibleItems = useMemo(() => {
        return results.slice(startIndex, endIndex)
    }, [results, startIndex, endIndex])

    useEffect(() => {
        const scrollArea = scrollAreaRef.current
        if (scrollArea) {
            const handleScrollAndResize = () => {
                if (scrollAreaRef.current) {
                    setContainerHeight(scrollAreaRef.current.clientHeight)

                    const newScrollTop = scrollAreaRef.current.scrollTop
                    setScrollTop(newScrollTop)

                    // Calculate if content overflows
                    const scrollHeight = scrollAreaRef.current.scrollHeight
                    const clientHeight = scrollAreaRef.current.clientHeight
                    setIsScrollable(scrollHeight > clientHeight)

                    // Show top gradient when scrolled down
                    setShowTopGradient(newScrollTop > 0)

                    // Show bottom gradient when not at the bottom
                    setShowBottomGradient(newScrollTop + clientHeight < scrollHeight)
                }
            }

            const resizeObserver = new ResizeObserver(handleScrollAndResize)
            resizeObserver.observe(scrollArea)

            scrollArea.addEventListener("scroll", handleScrollAndResize)
            handleScrollAndResize()

            return () => {
                resizeObserver.disconnect()
                scrollArea.removeEventListener("scroll", handleScrollAndResize)
            }
        }
    }, [results])

    return results.length === 0 && query && !indexing ? (
        <div className="results-empty-state">No Results</div>
    ) : (
        <div className={cx("results-container", isScrollable && "is-scrollable")}>
            <div className="results">
                <div className="container" ref={scrollAreaRef}>
                    <div
                        className="results-list"
                        style={{
                            height: results.length * ITEM_HEIGHT,
                            paddingTop: startIndex * ITEM_HEIGHT,
                        }}
                    >
                        {visibleItems.map(result => (
                            <RenameComparison
                                key={result.id}
                                selected={selectedNodeIds.includes(result.id)}
                                before={result.title}
                                after={getTextAfterRename(result)}
                                onClick={() => {
                                    void focusResult(result)
                                }}
                            >
                                <LayerIcon type={result.entry.type} />
                            </RenameComparison>
                        ))}
                    </div>

                    {indexing && query && (
                        <div className="loading-placeholders">
                            <PlaceholderRenameComparison index={0} total={5} width={30} />
                            <PlaceholderRenameComparison index={1} total={5} width={40} />
                            <PlaceholderRenameComparison index={2} total={5} width={20} />
                            <PlaceholderRenameComparison index={3} total={5} width={30} />
                            <PlaceholderRenameComparison index={4} total={5} width={20} />
                        </div>
                    )}
                </div>

                <div className={cx("overflow-gradient-top", !showTopGradient && "hidden")} />
                <div className={cx("overflow-gradient-bottom", !showBottomGradient && "hidden")} />
            </div>
        </div>
    )
}
