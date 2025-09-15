import { useMemo } from "react"
import { assertNever } from "../utils/assert"
import type { EntryResult } from "../utils/filter/group-results"
import { ResultType } from "../utils/filter/types"
import type { RootNodeType } from "../utils/indexer/types"
import { useFocusHandlers } from "../utils/useFocus"
import { Match } from "./Match"
import { IconArrowRight } from "./ui/IconArrowRight"
import { IconCode } from "./ui/IconCode"
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
        case "CodeFile":
            return <IconCode className={defaultIconClassName} />
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

    const focusProps = useFocusHandlers({ isSelfSelectable: false })

    return (
        <details open className="group flex flex-col not-last:pb-2">
            <summary
                className="pt-2 sticky top-0 group focus:outline-none bg-modal-light dark:bg-modal-dark cursor-pointer"
                {...focusProps}
            >
                <div className="flex flex-row gap-2 rounded-lg justify-start items-center h-6 select-none overflow-hidden ps-2 group-focus-visible:bg-option-light dark:group-focus-visible:bg-option-dark group-focus-visible:text-primary-light dark:group-focus-visible:text-primary-dark">
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
                {resultsWithRanges.map(result => {
                    switch (result.type) {
                        case ResultType.CollectionItemField:
                            return (
                                <Match
                                    key={result.id}
                                    type={ResultType.CollectionItemField}
                                    collectionFieldId={result.matchingField.id}
                                    targetId={result.entry.collectionItemId}
                                    text={result.text}
                                    range={result.range}
                                />
                            )
                        default:
                            return (
                                <Match
                                    key={result.id}
                                    type={result.type}
                                    targetId={result.entry.nodeId}
                                    text={result.text}
                                    range={result.range}
                                />
                            )
                    }
                })}
            </ul>
        </details>
    )
}
