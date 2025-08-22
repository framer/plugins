import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { FieldMapping } from "./components/FieldMapping"
import { Loading } from "./components/Loading"
import { SelectDataSource } from "./components/SelectDataSource"
import { getDataSource, pressRoomIdPluginKey } from "./data"
import type { PrCoDataSource } from "./dataSources"

interface AppProps {
    collection: ManagedCollection
    previousDataSourceId: string | null
    previousSlugFieldId: string | null
    previousPressRoomId: string | null
}

export function App({ collection, previousDataSourceId, previousSlugFieldId, previousPressRoomId }: AppProps) {
    const [pressRoomId, setPressRoomId] = useState<string>(previousPressRoomId ?? "")
    const [dataSource, setDataSource] = useState<PrCoDataSource | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useLayoutEffect(() => {
        const hasDataSourceSelected = Boolean(dataSource)

        void framer.showUI({
            width: hasDataSourceSelected ? 400 : 320,
            height: hasDataSourceSelected ? 427 : 295,
            minHeight: hasDataSourceSelected ? 427 : undefined,
            minWidth: hasDataSourceSelected ? 400 : undefined,
            resizable: hasDataSourceSelected,
        })
    }, [dataSource])

    useEffect(() => {
        if (!pressRoomId || !previousDataSourceId) return

        setIsLoading(true)
        getDataSource(pressRoomId, previousDataSourceId)
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
    }, [previousDataSourceId, previousPressRoomId])

    useEffect(() => {
        if (!pressRoomId) return
        if (pressRoomId === previousPressRoomId) return

        if (framer.isAllowedTo("setPluginData")) {
            void framer.setPluginData(pressRoomIdPluginKey, pressRoomId)
        }
    }, [pressRoomId, previousPressRoomId])

    if (isLoading) {
        return <Loading />
    }

    if (!pressRoomId || !dataSource) {
        return (
            <SelectDataSource
                onSelectPressRoomId={setPressRoomId}
                onSelectDataSource={setDataSource}
                previousDataSourceId={previousDataSourceId}
                previousPressRoomId={previousPressRoomId}
            />
        )
    }

    return (
        <FieldMapping
            collection={collection}
            pressRoomId={pressRoomId}
            dataSource={dataSource}
            initialSlugFieldId={previousSlugFieldId}
        />
    )
}
