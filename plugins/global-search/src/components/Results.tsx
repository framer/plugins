import { assertNever } from "../utils/assert"
import type { GroupedResult } from "../utils/filter/group-results"

import type { Range } from "../utils/filter/ranges"
import type { CollectionItemResult, NodeResult, Result } from "../utils/filter/types"

interface ResultsProps {
    results: readonly GroupedResult[]
}

export function Results({ results }: ResultsProps) {
    return results.map(result => <SearchResultGroup key={result.entry.id} groupedResult={result} />)
}

function SearchResultGroup({ groupedResult }: { groupedResult: GroupedResult }) {
    if (groupedResult.results.length === 0) return null

    return (
        <div className="flex flex-col gap-2 mb-4 text-amber-500">
            <div className="text-lg text-amber-800">
                {groupedResult.entry.rootNodeName || "Unnamed"} ({groupedResult.entry.rootNodeType}{" "}
                {groupedResult.entry.rootNode.id})
            </div>
            <ul className="flex flex-col gap-2">
                {groupedResult.results.map(result => (
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
