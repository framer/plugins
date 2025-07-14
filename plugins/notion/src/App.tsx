import "./App.css"

import { APIErrorCode, APIResponseError } from "@notionhq/client"
import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import auth from "./auth"
import { type DatabaseIdMap, type DataSource, getDataSource } from "./data"
import { FieldMapping } from "./FieldMapping"
import { NoTableAccess } from "./NoAccess"
import { SelectDataSource } from "./SelectDataSource"
import { showAccessErrorUI, showFieldMappingUI, showLoginUI } from "./ui"

interface AppProps {
    collection: ManagedCollection
    previousDatabaseId: string | null
    previousSlugFieldId: string | null
    previousLastSynced: string | null
    previousIgnoredFieldIds: string | null
    previousDatabaseName: string | null
    existingCollectionDatabaseIdMap: DatabaseIdMap
}

export function App({
    collection,
    previousDatabaseId,
    previousSlugFieldId,
    previousLastSynced,
    previousIgnoredFieldIds,
    previousDatabaseName,
    existingCollectionDatabaseIdMap,
}: AppProps) {
    const [dataSource, setDataSource] = useState<DataSource | null>(null)
    const [isLoadingDataSource, setIsLoadingDataSource] = useState(Boolean(previousDatabaseId))
    const [hasAccessError, setHasAccessError] = useState(false)

    // Support self-referencing databases by allowing the current collection to be referenced.
    const databaseIdMap = useMemo(() => {
        if (dataSource?.database.id) {
            return new Map(existingCollectionDatabaseIdMap).set(dataSource.database.id, collection.id)
        }
        return existingCollectionDatabaseIdMap
    }, [existingCollectionDatabaseIdMap, dataSource?.database.id, collection.id])

    useLayoutEffect(() => {
        const showUI = async () => {
            try {
                if (hasAccessError) {
                    await showAccessErrorUI()
                } else if (dataSource || isLoadingDataSource) {
                    await showFieldMappingUI()
                } else {
                    await showLoginUI()
                }
            } catch (error) {
                console.error(error)
                framer.notify(`Error opening plugin. Check the logs for more details.`, { variant: "error" })
            }
        }

        void showUI()
    }, [dataSource, isLoadingDataSource, hasAccessError])

    useEffect(() => {
        if (!previousDatabaseId) {
            return
        }

        const abortController = new AbortController()

        setIsLoadingDataSource(true)
        getDataSource(previousDatabaseId, abortController.signal)
            .then(setDataSource)
            .catch((error: unknown) => {
                if (abortController.signal.aborted) return

                console.error(error)

                // Check for Notion API error codes
                if (
                    error instanceof APIResponseError &&
                    (error.code === APIErrorCode.RestrictedResource ||
                        error.code === APIErrorCode.ObjectNotFound ||
                        error.code === APIErrorCode.Unauthorized ||
                        error.status === 403)
                ) {
                    setHasAccessError(true)
                } else {
                    framer.notify(
                        `Error loading previously configured database "${previousDatabaseName ?? previousDatabaseId}". Check the logs for more details.`,
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
    }, [previousDatabaseId, previousDatabaseName])

    useEffect(() => {
        void framer.setMenu([
            {
                label: `View ${dataSource?.name ?? ""} in Notion`,
                visible: Boolean(dataSource?.database.url),
                onAction: () => {
                    if (!dataSource?.database) return
                    window.open(dataSource.database.url, "_blank")
                },
            },
            { type: "separator" },
            {
                label: "Log Out",
                onAction: () => {
                    void auth.logout()
                },
            },
        ])
    }, [dataSource])

    if (isLoadingDataSource) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
                <p>Loading {previousDatabaseName ?? "database"}...</p>
            </main>
        )
    }

    if (hasAccessError) {
        return <NoTableAccess previousDatabaseId={previousDatabaseId} />
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
            databaseIdMap={databaseIdMap}
        />
    )
}
