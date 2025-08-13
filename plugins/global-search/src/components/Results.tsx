import { assertNever } from "../utils/assert"
import type { EntryResult } from "../utils/filter/group-results"
import type { Range } from "../utils/filter/ranges"
import type { CollectionItemResult, NodeResult, Result } from "../utils/filter/types"
import type { RootNodeType } from "../utils/indexer/types"
import { IconArrowRight } from "./ui/IconArrowRight"
import { IconCollection } from "./ui/IconCollection"
import { IconComponent } from "./ui/IconComponent"
import { IconWebPage } from "./ui/IconWebPage"

interface ResultsProps {
    groupedResults: readonly EntryResult[]
}

export function ResultsList({ groupedResults }: ResultsProps) {
    return (
        <div className="flex flex-col pt-2">
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

function EntryResult({ entry, results }: { entry: EntryResult["entry"]; results: EntryResult["results"] }) {
    return (
        <details open className="group flex flex-col gap-2">
            <summary className="flex flex-row gap-2 justify-start items-center h-6">
                <IconArrowRight
                    className="text-tertiary-light dark:text-tertiary-dark transition-transform duration-200 ease-in-out group-open:rotate-90"
                    aria-hidden="true"
                />

                <ResultIcon rootNodeType={entry.rootNodeType} aria-hidden="true" />

                <span className="text-xs text-secondary-light dark:text-secondary-dark whitespace-nowrap overflow-ellipsis">
                    {entry.rootNodeName || `Unnamed ${entry.rootNodeType}`}
                </span>
            </summary>
            <ul className="flex flex-col gap-2 ms-5 text-amber-500 text-xs">
                {results.map(result => (
                    <SearchResult key={result.id} result={result} />
                ))}
            </ul>
        </details>
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
    const highlight = text.slice(start, end)
    const after = text.slice(end)

    return (
        <>
            {before}
            <span className="font-bold">{match}</span>
            {after}
        </>
    )
}
