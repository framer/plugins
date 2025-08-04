import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { FieldMapping } from "./components/FieldMapping"
import { Loading } from "./components/Loading"
import { SelectDataSource } from "./components/SelectDataSource"
import { getDataSource, jobBoardNamePluginKey } from "./data"
import type { AshbyDataSource } from "./dataSources"

interface AppProps {
    collection: ManagedCollection
    previousDataSourceId: string | null
    previousSlugFieldId: string | null
    previousJobBoardName: string | null
}

export function App({ collection, previousDataSourceId, previousSlugFieldId, previousJobBoardName }: AppProps) {
    const [jobBoardName, setJobBoardName] = useState<string>(previousJobBoardName ?? "")
    const [dataSource, setDataSource] = useState<AshbyDataSource | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useLayoutEffect(() => {
        const hasDataSourceSelected = Boolean(dataSource)

        void framer.showUI({
            width: hasDataSourceSelected ? 400 : 320,
            height: hasDataSourceSelected ? 427 : 285,
            minHeight: hasDataSourceSelected ? 427 : undefined,
            minWidth: hasDataSourceSelected ? 400 : undefined,
            resizable: hasDataSourceSelected,
        })
    }, [dataSource])

    useEffect(() => {
        if (!previousJobBoardName || !previousDataSourceId) return

        setIsLoading(true)
        getDataSource(previousJobBoardName, previousDataSourceId)
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
    }, [previousDataSourceId, previousJobBoardName])

    useEffect(() => {
        if (!jobBoardName) return
        if (jobBoardName === previousJobBoardName) return

        if (framer.isAllowedTo("setPluginData")) {
            void framer.setPluginData(jobBoardNamePluginKey, jobBoardName)
        }
    }, [jobBoardName, previousJobBoardName])

    if (isLoading) {
        return <Loading />
    }

    if (!jobBoardName || !dataSource) {
        return (
            <SelectDataSource
                onSelectJobBoardName={setJobBoardName}
                onSelectDataSource={setDataSource}
                previousDataSourceId={previousDataSourceId}
                previousJobBoardName={previousJobBoardName}
            />
        )
    }

    return (
        <FieldMapping
            collection={collection}
            jobBoardName={jobBoardName}
            dataSource={dataSource}
            initialSlugFieldId={previousSlugFieldId}
        />
    )
}
