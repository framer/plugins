import cx from "classnames"
import { framer } from "framer-plugin"
import { useEffect, useRef, useState } from "react"

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

export default function Results({ query, indexing, results, selectedNodeIds, getTextAfterRename }: Props) {
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const [showTopGradient, setShowTopGradient] = useState(false)
    const [showBottomGradient, setShowBottomGradient] = useState(false)

    const focusResult = async (result: Result) => {
        await framer.setSelection(result.id)
        await framer.zoomIntoView(result.id, { maxZoom: 1 })
    }

    const handleScroll = () => {
        if (scrollAreaRef.current) {
            const scrollTop = scrollAreaRef.current.scrollTop

            // Show top gradient when scrolled down
            setShowTopGradient(scrollTop > 0)

            // Show bottom gradient when not at the bottom
            const scrollHeight = scrollAreaRef.current.scrollHeight
            const clientHeight = scrollAreaRef.current.clientHeight
            setShowBottomGradient(scrollTop + clientHeight < scrollHeight)
        }
    }

    useEffect(() => {
        const scrollArea = scrollAreaRef.current
        if (scrollArea) {
            scrollArea.addEventListener("scroll", handleScroll)
            // Initial check
            handleScroll()

            return () => {
                scrollArea.removeEventListener("scroll", handleScroll)
            }
        }
    }, [results])

    return (
        <div className="results">
            <div className={cx("overflow-gradient-top", !showTopGradient && "hidden")} />

            <div className="container" ref={scrollAreaRef}>
                {results.map((result, index) => (
                    <RenameComparison
                        key={`${result.title}-${index}`}
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

            <div className={cx("overflow-gradient-bottom", !showBottomGradient && "hidden")} />

            {results.length === 0 && query && !indexing && <div className="empty-state">No Results</div>}
        </div>
    )
}
