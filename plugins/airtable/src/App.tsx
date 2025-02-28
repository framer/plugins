import "./App.css"

import type { ManagedCollection } from "framer-plugin"

import { framer } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { inferFields, type DataSource } from "./data"
import { FieldMapping } from "./FieldMapping"
import { SelectDataSource } from "./SelectDataSource"
import { fetchTable } from "./api"
import { NoTableAccess } from "./NoAccess"

interface AppProps {
    collection: ManagedCollection
    previousBaseId: string | null
    previousTableId: string | null
    previousSlugFieldId: string | null
}

export function App({ collection, previousBaseId, previousTableId, previousSlugFieldId }: AppProps) {
    const [dataSource, setDataSource] = useState<DataSource | null>(null)
    const [isLoadingDataSource, setIsLoadingDataSource] = useState(Boolean(previousBaseId && previousTableId))
    const [noTableAccess, setNoTableAccess] = useState(false)

    useLayoutEffect(() => {
        const hasDataSourceSelected = Boolean(dataSource)

        framer.showUI({
            width: hasDataSourceSelected ? 360 : 320,
            height: hasDataSourceSelected ? 425 : 350,
            minWidth: hasDataSourceSelected ? 360 : undefined,
            minHeight: hasDataSourceSelected ? 425 : undefined,
            resizable: hasDataSourceSelected,
        })
    }, [dataSource])

    useEffect(() => {
        if (!previousBaseId || !previousTableId) {
            return
        }

        setIsLoadingDataSource(true)
        fetchTable(previousBaseId, previousTableId)
            .then(async table => {
                if (!table) {
                    setNoTableAccess(true)
                    return
                }

                const fields = await inferFields(collection, table)
                setDataSource({
                    baseId: previousBaseId,
                    tableId: previousTableId,
                    tableName: table.name,
                    fields,
                })
            })
            .catch(() => {
                setNoTableAccess(true)
            })
            .finally(() => {
                setIsLoadingDataSource(false)
            })
    }, [])

    if (isLoadingDataSource) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
            </main>
        )
    }

    if (noTableAccess) {
        return <NoTableAccess previousBaseId={previousBaseId} previousTableId={previousTableId} />
    }

    if (!dataSource) {
        return <SelectDataSource collection={collection} onSelectDataSource={setDataSource} />
    }

    return <FieldMapping collection={collection} dataSource={dataSource} initialSlugFieldId={previousSlugFieldId} />
}
