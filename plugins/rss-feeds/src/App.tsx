import { framer, type ManagedCollection, useIsAllowedTo } from "framer-plugin"

import "./App.css"
import { useCallback, useState } from "react"
import { importData, rssSources } from "./data"
import { RSSIcon } from "./icons"

interface Props {
    collection: ManagedCollection
    initialRssSourceId: string | null
}

export function App({ collection, initialRssSourceId }: Props) {
    const [selectedSourceId, setSelectedSourceId] = useState<string>(initialRssSourceId ?? rssSources[0].id)
    const [isSyncing, setIsSyncing] = useState(false)

    const selectedSource = rssSources.find(source => source.id === selectedSourceId)

    const isAllowedToImportData = useIsAllowedTo(
        "ManagedCollection.addItems",
        "ManagedCollection.removeItems",
        "ManagedCollection.setFields",
        "ManagedCollection.setPluginData"
    )

    const handleImport = useCallback(() => {
        if (!isAllowedToImportData) return
        if (!selectedSource) return

        setIsSyncing(true)

        const task = async () => {
            try {
                await importData(collection, selectedSourceId)
                await framer.closePlugin()
            } finally {
                setIsSyncing(false)
            }
        }

        void task()
    }, [isAllowedToImportData, selectedSource, collection, selectedSourceId])

    return (
        <main>
            <div className="illustration">
                <RSSIcon />
            </div>
            <p>Import the most recent blog content from a public RSS feed such as ESPN or Wired.</p>

            <div className="field">
                <label className="label" htmlFor="selectSource">
                    Feed
                </label>
                <select
                    id="selectSource"
                    className="select"
                    value={selectedSourceId}
                    onChange={e => {
                        setSelectedSourceId(e.target.value)
                    }}
                >
                    {rssSources.map(source => (
                        <option value={source.id} key={source.id}>
                            {source.name}
                        </option>
                    ))}
                </select>
            </div>

            <button
                className="framer-button-primary"
                onClick={handleImport}
                disabled={!isAllowedToImportData || !selectedSource || isSyncing}
                title={isAllowedToImportData ? undefined : "Insufficient permissions"}
            >
                Import
            </button>
        </main>
    )
}
