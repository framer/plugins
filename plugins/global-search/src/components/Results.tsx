import { framer } from "framer-plugin"
import { useCallback, useMemo } from "react"
import { assertNever } from "../utils/assert"
import { cn } from "../utils/className"
import type { EntryResult } from "../utils/filter/group-results"
import { type Range, rangeLength } from "../utils/filter/ranges"
import type { RootNodeType } from "../utils/indexer/types"
import { truncateFromStart } from "../utils/text"
import { IconArrowRight } from "./ui/IconArrowRight"
import { IconCollection } from "./ui/IconCollection"
import { IconComponent } from "./ui/IconComponent"
import { IconWebPage } from "./ui/IconWebPage"

interface ResultsProps {
    groupedResults: readonly EntryResult[]
}

export function ResultsList({ groupedResults }: ResultsProps) {
    return (
        <div className="flex flex-col divide-y divide-divider-light dark:divide-divider-dark">
            {groupedResults.map(group => (
                <ResultPerEntry key={group.entry.id} entry={group.entry} results={group.results} />
            ))}
        </div>
    )
}

const defaultIconClassName = "text-tertiary-light dark:text-tertiary-dark"
export function ResultIcon({ rootNodeType }: { rootNodeType: RootNodeType }) {
    switch (rootNodeType) {
        case "WebPageNode":
            return <IconWebPage className={defaultIconClassName} />
        case "Collection":
            return <IconCollection className={defaultIconClassName} />
        case "ComponentNode":
            return <IconComponent className={defaultIconClassName} />
        default:
            assertNever(rootNodeType)
    }
}

function ResultPerEntry({ entry, results }: { entry: EntryResult["entry"]; results: EntryResult["results"] }) {
    const resultsWithRanges = useMemo(() => {
        // each result could have multiple ranges, but we want to show each range as a separate result
        return results.flatMap(result => {
            return result.ranges.map(range => ({
                ...result,
                id: `${result.id}-${range.join("-")}`,
                range,
            }))
        })
    }, [results])

    return (
        <details open className="group flex flex-col not-first:pt-2 not-last:pb-2">
            <summary className="pt-2 group focus-visible:outline-none">
                <div className="flex flex-row gap-2 rounded-lg justify-start items-center h-8 select-none overflow-hidden ps-2 sticky top-0 bg-modal-light dark:bg-modal-dark group-focus-visible:bg-option-light dark:group-focus-visible:bg-option-dark group-focus-visible:text-primary-light dark:group-focus-visible:text-primary-dark">
                    <div className="flex-shrink-0 flex gap-2 justify-start items-center">
                        <IconArrowRight
                            className="text-tertiary-light dark:text-tertiary-dark  transition-transform duration-200 ease-in-out group-open:rotate-90"
                            aria-hidden="true"
                        />

                        <ResultIcon rootNodeType={entry.rootNodeType} aria-hidden="true" />
                    </div>

                    <div className="text-xs text-secondary-light dark:text-secondary-dark whitespace-nowrap text-ellipsis flex-1 overflow-hidden">
                        {entry.rootNodeName ?? `Unnamed ${entry.rootNodeType}`}
                    </div>
                </div>
            </summary>
            <ul className="flex flex-col">
                {resultsWithRanges.map(result => (
                    <Match
                        key={result.id}
                        targetId={entry.type === "CollectionItemField" ? entry.collectionItemId : entry.nodeId}
                        text={result.text}
                        range={result.range}
                        collectionFieldId={entry.type === "CollectionItemField" ? entry.matchingField.id : undefined}
                    />
                ))}
            </ul>
        </details>
    )
}

function Match({
    targetId,
    text,
    range,
    collectionFieldId,
}: {
    targetId: string
    text: string
    range: Range
    collectionFieldId: string | undefined
}) {
    const navigateToResult = useCallback(() => {
        framer
            .navigateTo(targetId, {
                scrollTo: collectionFieldId ? { collectionFieldId } : undefined,
            })
            .catch((error: unknown) => {
                framer.notify(`Failed to go to item. ${error instanceof Error ? error.message : "Unknown error"}`)
            })
    }, [targetId, collectionFieldId])

    const { before, highlight, after } = useHighlightedTextWithContext({ text, range })

    return (
        <button
            onClick={navigateToResult}
            className={cn(
                "text-secondary-light dark:text-secondary-dark text-xs h-6 text-left select-none cursor-pointer pl-5  rounded-lg transition-colors",
                "hover:bg-option-light dark:hover:bg-option-dark hover:text-primary-light dark:hover:text-primary-dark focus-visible:bg-option-light dark:focus-visible:bg-option-dark focus-visible:text-primary-light focus-visible:outline-none dark:focus-visible:text-primary-dark",
                "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            )}
        >
            <li className="text-ellipsis overflow-hidden whitespace-nowrap">
                {before}
                <span className="font-semibold bg-transparent">{highlight}</span>
                {after}
            </li>
        </button>
    )
}

const rowLength = 30
function useHighlightedTextWithContext({ text, range }: { text: string; range: Range }) {
    const [start, end] = range
    const maxBeforeLength = Math.floor((rowLength - rangeLength(range)) / 2)
    const before = text.slice(0, start)
    const highlight = text.slice(start, end)
    const after = text.slice(end)

    const limitedBefore = useMemo(
        () => (text.length < rowLength ? before : truncateFromStart(before, maxBeforeLength)),
        [before, text, maxBeforeLength]
    )

    return { before: limitedBefore, highlight: highlight, after }
}
