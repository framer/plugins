import { framer } from "framer-plugin"

import type { Result } from "../search/types"
import LayerIcon from "./LayerIcon"
import PlaceholderRenameComparison from "./PlaceholderRenameComparison"
import RenameComparison from "./RenameComparison"
import "./Results.css"

interface Props {
    query: string
    indexing: boolean
    results: Result[]
    selectedNodeIds: string[]
    getTextAfterRename: (result: Result) => string
}

export default function Results({ query, indexing, results, selectedNodeIds, getTextAfterRename }: Props) {
    const focusResult = async (result: Result) => {
        await framer.setSelection(result.id)
        await framer.zoomIntoView(result.id, { maxZoom: 1 })
    }

    return (
        <div className="results">
            <div className="list-container">
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

            {results.length === 0 && query && !indexing && <div className="empty-state">No Results</div>}
        </div>
    )
}
