import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { FieldMapping } from "./components/FieldMapping"
import { SelectDataSource } from "./components/SelectDataSource"
import { getDataSource, spaceIdPluginKey } from "./data"
import { GreenhouseDataSource } from "./data-source/types"

interface AppProps {
    collection: ManagedCollection
    previousDataSourceId: string | null
    previousSlugFieldId: string | null
    previousBoardToken: string | null
}

export function App({ collection, previousDataSourceId, previousSlugFieldId, previousBoardToken }: AppProps) {
    const [dataSource, setDataSource] = useState<GreenhouseDataSource | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useLayoutEffect(() => {
        const hasDataSourceSelected = Boolean(dataSource)

        framer.showUI({
            width: hasDataSourceSelected ? 320 : 320,
            height: hasDataSourceSelected ? 427 : 325,
            minHeight: hasDataSourceSelected ? 427 : undefined,
            resizable: hasDataSourceSelected,
        })
    }, [dataSource])

    useEffect(() => {
        if (!previousBoardToken || !previousDataSourceId) return

        setIsLoading(true)
        getDataSource(previousBoardToken, previousDataSourceId)
            .then(setDataSource)
            .catch(error => {
                console.error(`Error loading previously configured data source “${previousDataSourceId}”.`, error)
                framer.notify(`Error loading previously configured data source “${previousDataSourceId}”.`, {
                    variant: "error",
                })
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [previousDataSourceId, previousBoardToken])

    if (isLoading) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
            </main>
        )
    }

    if (!previousBoardToken || !dataSource) {
        return (
            <SelectDataSource
                onSelectBoardToken={boardToken => {
                    void framer.setPluginData(spaceIdPluginKey, boardToken)
                }}
                onSelectDataSource={setDataSource}
                previousDataSourceId={previousDataSourceId}
                previousBoardToken={previousBoardToken}
            />
        )
    }

    return (
        <FieldMapping
            collection={collection}
            boardToken={previousBoardToken}
            dataSource={dataSource}
            initialSlugFieldId={previousSlugFieldId}
        />
    )
}
