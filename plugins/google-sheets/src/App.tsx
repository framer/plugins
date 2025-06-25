import "./App.css"

import { framer, type ManagedCollection, type ManagedCollectionFieldInput } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { type DataSource, getDataSource } from "./data"
import { FieldMapping } from "./FieldMapping"
import { SelectDataSource } from "./SelectDataSource"
import { useSheetQuery } from "./sheets"

interface AppProps {
    collection: ManagedCollection
    collectionFields: ManagedCollectionFieldInput[]
    previousDataSourceId: string | null
    previousSlugFieldId: string | null
}

export function App({ collection, collectionFields, previousDataSourceId, previousSlugFieldId }: AppProps) {
    const [dataSource, setDataSource] = useState<DataSource | null>(null)
    const [isLoadingDataSource, setIsLoadingDataSource] = useState(Boolean(previousDataSourceId))

    const { data: sheet, isPending: isSheetPending } = useSheetQuery(dataSource?.id ?? "", dataSource?.sheetTitle ?? "")

    const isSheetLoading = dataSource && isSheetPending

    useLayoutEffect(() => {
        if (dataSource || isSheetLoading) {
            framer.showUI({
                width: 600,
                height: 500,
                minWidth: 360,
                minHeight: 425,
                resizable: true,
            })
        } else {
            framer.showUI({
                width: 320,
                height: 345,
                minWidth: 320,
                minHeight: 345,
                resizable: false,
            })
        }
    }, [dataSource])

    useEffect(() => {
        if (!previousDataSourceId) {
            return
        }

        const abortController = new AbortController()

        setIsLoadingDataSource(true)
        getDataSource(previousDataSourceId, abortController.signal)
            .then(setDataSource)
            .catch(error => {
                if (abortController.signal.aborted) return

                console.error(error)
                framer.notify(
                    `Error loading previously configured data source “${previousDataSourceId}”. Check the logs for more details.`,
                    {
                        variant: "error",
                    }
                )
            })
            .finally(() => {
                if (abortController.signal.aborted) return

                setIsLoadingDataSource(false)
            })

        return () => abortController.abort()
    }, [previousDataSourceId])

    if (isLoadingDataSource) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
            </main>
        )
    }

    if (!dataSource) {
        return <SelectDataSource onSelectDataSource={setDataSource} />
    }

    if (isSheetPending) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
                <p>Loading {dataSource?.sheetTitle || "sheet"}...</p>
            </main>
        )
    }

    if (!sheet?.values || sheet.values.length === 0) {
        throw new Error("The provided sheet requires at least one row")
    }

    // TEMPORARY
    const finalDataSource = { ...dataSource, sheetRows: sheet?.values ?? [] }

    return (
        <FieldMapping
            collection={collection}
            collectionFields={collectionFields}
            dataSource={finalDataSource}
            initialSlugFieldId={previousSlugFieldId}
        />
    )
}
