import { framer } from "framer-plugin"
import { useEffect, useMemo, useState } from "react"
import { cn } from "../utils/className"
import { type IndexEntry } from "../utils/indexer/types"
import { useIndexer } from "../utils/indexer/useIndexer"
import { getPluginSize } from "../utils/plugin-size"

export function DevToolsScene() {
    const { index, isIndexing, indexerInstance } = useIndexer()

    const [selectedEntry, setSelectedEntry] = useState<IndexEntry | null>(null)

    const [filterQuery, setFilterQuery] = useState("")

    const entries = useMemo(() => Object.values(index), [index])

    const filteredEntries = useMemo(
        () =>
            entries.filter(entry => {
                if (entry.id === filterQuery) return true
                switch (entry.type) {
                    case "CollectionItem":
                        return Object.values(entry.fields).some(field =>
                            field.toLowerCase().includes(filterQuery.toLowerCase())
                        )
                    default:
                        return entry.name?.toLowerCase().includes(filterQuery.toLowerCase())
                }
            }),
        [entries, filterQuery]
    )

    useEffect(() => {
        framer.showUI({
            height: Infinity,
            width: Infinity,
            resizable: true,
        })
        return () => {
            framer.showUI({
                ...getPluginSize({ query: undefined, hasResults: false }),
                resizable: false,
            })
        }
    }, [])

    const stats = useMemo(
        () => ({
            total: entries.length,
            byType: entries.reduce(
                (acc, entry) => {
                    acc[entry.type] = (acc[entry.type] ?? 0) + 1
                    return acc
                },
                {} as Record<string, number>
            ),
        }),
        [entries]
    )

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-col gap-2 p-2">
                <div className=" flex gap-1">
                    <input
                        type="text"
                        placeholder="Filter by name or id"
                        value={filterQuery}
                        onChange={e => setFilterQuery(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded flex-1"
                    />
                    <button
                        onClick={() => indexerInstance.restart()}
                        disabled={isIndexing}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded disabled:opacity-50 w-auto"
                    >
                        {isIndexing ? "Indexing..." : "Re-index"}
                    </button>
                </div>
                <div className="text-xs text-gray-600 gap-x-1 flex space-between">
                    {Object.entries(stats.byType).map(([type, count]) => (
                        <span key={type} className="bg-gray-100 px-2 py-1 rounded block">
                            {type}: {count}
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden border-t border-t-framer-divider">
                <div className="w-1/3 max-w-sm border-r border-r-framer-divider overflow-auto">
                    <div className="divide-y">
                        {filteredEntries.map(entry => (
                            <div
                                key={`${entry.id}-${entry.type}`}
                                className={cn(
                                    "p-3 cursor-pointer hover:bg-gray-50",
                                    selectedEntry === entry && "bg-blue-50"
                                )}
                                onClick={() => setSelectedEntry(entry)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {entry.type === "CollectionItem"
                                                ? `${entry.rootNodeName} - ${entry.slug}`
                                                : entry.name || "Unnamed"}
                                        </p>
                                        <p className="text-xs text-gray-500">{entry.type}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detail Panel */}
                <div className="flex-1 overflow-auto">
                    {selectedEntry ? (
                        <div className="p-4 space-y-4">
                            <h3 className="font-semibold">Entry Details</h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">ID</label>
                                    <code className="text-xs bg-gray-100 p-2 rounded block font-mono">
                                        {selectedEntry.id}
                                    </code>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                                    <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                        {selectedEntry.type}
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                                    <p className="text-sm bg-gray-50 p-2 rounded">
                                        {selectedEntry.type === "CollectionItem"
                                            ? "Collection Item"
                                            : selectedEntry.name || "(no name)"}
                                    </p>
                                </div>

                                {selectedEntry.type !== "CollectionItem" && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Text Content
                                        </label>
                                        <p className="text-sm bg-gray-50 p-2 rounded whitespace-pre-wrap">
                                            {selectedEntry.text}
                                        </p>
                                    </div>
                                )}

                                {selectedEntry.type === "CollectionItem" && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Fields</label>
                                        <pre className="text-sm bg-gray-50 p-2 rounded whitespace-pre-wrap">
                                            {JSON.stringify(selectedEntry.fields, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Root Node</label>
                                    <p className="text-sm bg-gray-50 p-2 rounded">
                                        {selectedEntry.rootNodeName} ({selectedEntry.rootNodeType})
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Raw Node Data
                                    </label>
                                    <details className="text-xs">
                                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                            Show raw node object
                                        </summary>
                                        <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto text-xs">
                                            {JSON.stringify(
                                                {
                                                    ...(selectedEntry.type === "CollectionItem"
                                                        ? selectedEntry.collectionItem
                                                        : selectedEntry.node),
                                                },
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </details>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 text-center text-gray-500">Select an entry to view details</div>
                    )}
                </div>
            </div>
        </div>
    )
}
