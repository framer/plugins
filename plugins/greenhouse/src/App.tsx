import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { FieldMapping } from "./components/FieldMapping"
import { Loading } from "./components/Loading"
import { SelectDataSource } from "./components/SelectDataSource"
import { getDataSource, spaceIdPluginKey } from "./data"
import type { GreenhouseDataSource } from "./dataSources"

interface AppProps {
    collection: ManagedCollection
    previousDataSourceId: string | null
    previousSlugFieldId: string | null
    previousBoardToken: string | null
}

export function App({ collection, previousDataSourceId, previousSlugFieldId, previousBoardToken }: AppProps) {
    const [boardToken, setBoardToken] = useState<string>(previousBoardToken ?? "")
    const [dataSource, setDataSource] = useState<GreenhouseDataSource | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useLayoutEffect(() => {
        const hasDataSourceSelected = Boolean(dataSource)

        void framer.showUI({
            width: hasDataSourceSelected ? 400 : 320,
            height: hasDataSourceSelected ? 427 : 325,
            minHeight: hasDataSourceSelected ? 427 : undefined,
            minWidth: hasDataSourceSelected ? 400 : undefined,
            resizable: hasDataSourceSelected,
        })
    }, [dataSource])

    useEffect(() => {
        if (!previousBoardToken || !previousDataSourceId) return

        setIsLoading(true)
        getDataSource(previousBoardToken, previousDataSourceId)
            .then(setDataSource)
            .catch((error: unknown) => {
                console.error(`Error loading previously configured data source “${previousDataSourceId}”.`, error)
                framer.notify(`Error loading previously configured data source “${previousDataSourceId}”.`, {
                    variant: "error",
                })
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [previousDataSourceId, previousBoardToken])

    useEffect(() => {
        if (!boardToken) return
        if (boardToken === previousBoardToken) return

        if (framer.isAllowedTo("setPluginData")) {
            void framer.setPluginData(spaceIdPluginKey, boardToken)
        }
    }, [boardToken, previousBoardToken])

    if (isLoading) {
        return <Loading />
    }

    if (!boardToken || !dataSource) {
        return (
            <SelectDataSource
                onSelectBoardToken={setBoardToken}
                onSelectDataSource={setDataSource}
                previousDataSourceId={previousDataSourceId}
                previousBoardToken={previousBoardToken}
            />
        )
    }

    return (
        <FieldMapping
            collection={collection}
            boardToken={boardToken}
            dataSource={dataSource}
            initialSlugFieldId={previousSlugFieldId}
        />
    )
}
