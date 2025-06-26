import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { type DataSource, getDataSource } from "./data"
import { FieldMapping } from "./FieldMapping"
import { SelectDataSource } from "./SelectDataSource"
import { NoTableAccess } from "./NoAccess"
import { APIErrorCode } from "@notionhq/client"

interface AppProps {
    collection: ManagedCollection
    previousDataSourceId: string | null
    previousSlugFieldId: string | null
    previousLastSynced: string | null
    previousIgnoredFieldIds: string | null
    previousDatabaseName: string | null
}

export function App({
    collection,
    previousDataSourceId,
    previousSlugFieldId,
    previousLastSynced,
    previousIgnoredFieldIds,
    previousDatabaseName,
}: AppProps) {
    const [dataSource, setDataSource] = useState<DataSource | null>(null)
    const [isLoadingDataSource, setIsLoadingDataSource] = useState(Boolean(previousDataSourceId))
    const [hasAccessError, setHasAccessError] = useState(false)

    useLayoutEffect(() => {
        if (hasAccessError) {
            framer.showUI({
                width: 280,
                height: 114,
                resizable: false,
            })
        } else if (dataSource || isLoadingDataSource) {
            framer.showUI({
                width: 425,
                height: 425,
                minWidth: 360,
                minHeight: 425,
                resizable: true,
            })
        } else {
            framer.showUI({
                width: 260,
                height: 345,
                minWidth: 260,
                minHeight: 345,
                resizable: false,
            })
        }
    }, [dataSource, isLoadingDataSource])

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

                // Check for Notion API error codes
                if (
                    error.code === APIErrorCode.RestrictedResource ||
                    error.code === APIErrorCode.ObjectNotFound ||
                    error.code === APIErrorCode.Unauthorized ||
                    error.status === 403
                ) {
                    setHasAccessError(true)
                } else {
                    framer.notify(
                        `Error loading previously configured database "${previousDatabaseName || previousDataSourceId}". Check the logs for more details.`,
                        { variant: "error" }
                    )
                }
            })
            .finally(() => {
                if (abortController.signal.aborted) return

                setIsLoadingDataSource(false)
            })

        return () => {
            abortController.abort()
        }
    }, [previousDataSourceId])

    if (isLoadingDataSource) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
                <p>Loading {previousDatabaseName || "database"}...</p>
            </main>
        )
    }

    if (hasAccessError) {
        return <NoTableAccess previousDatabaseId={previousDataSourceId} />
    }

    if (!dataSource) {
        return <SelectDataSource onSelectDataSource={setDataSource} />
    }

    return (
        <FieldMapping
            collection={collection}
            dataSource={dataSource}
            initialSlugFieldId={previousSlugFieldId}
            previousLastSynced={previousLastSynced}
            previousIgnoredFieldIds={previousIgnoredFieldIds}
        />
    )
}
