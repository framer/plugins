import "./App.css"

import { APIErrorCode, APIResponseError } from "@notionhq/client"
import { FramerPluginClosedError, framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import auth from "./auth"
import {
    type DatabaseIdMap,
    type DataSource,
    getDataSource,
    type SyncProgress,
    shouldSyncExistingCollection,
    syncExistingCollection,
} from "./data"
import { FieldMapping } from "./FieldMapping"
import { NoTableAccess } from "./NoAccess"
import { Progress } from "./Progress"
import { SelectDataSource } from "./SelectDataSource"
import { showAccessErrorUI, showFieldMappingUI, showLoginUI, showProgressUI } from "./ui"

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
    const [isSyncMode, setIsSyncMode] = useState<boolean>(
        shouldSyncExistingCollection({
            previousSlugFieldId,
            previousDatabaseId,
        })
    )
    const [progress, setProgress] = useState<SyncProgress>({
        current: 0,
        total: 0,
        hasFinishedLoading: false,
    })
    const hasRunSyncRef = useRef(false)

    useEffect(() => {
        if (!isSyncMode || hasRunSyncRef.current) return

        hasRunSyncRef.current = true

        const task = async () => {
            void showProgressUI()

            try {
                const { didSync } = await syncExistingCollection(
                    collection,
                    previousDatabaseId,
                    previousSlugFieldId,
                    previousIgnoredFieldIds,
                    previousLastSynced,
                    previousDatabaseName,
                    existingCollectionDatabaseIdMap,
                    setProgress
                )

                if (didSync) {
                    framer.closePlugin("Synchronization successful", {
                        variant: "success",
                    })
                } else {
                    setIsSyncMode(false)
                }
            } catch (error) {
                if (error instanceof FramerPluginClosedError) return

                console.error(error)
                setIsSyncMode(false)
                framer.notify(error instanceof Error ? error.message : "Failed to sync collection", {
                    variant: "error",
                    durationMs: 10000,
                })
            }
        }

        void task()
    }, [
        isSyncMode,
        collection,
        previousDatabaseId,
        previousSlugFieldId,
        previousIgnoredFieldIds,
        previousLastSynced,
        previousDatabaseName,
        existingCollectionDatabaseIdMap,
    ])

    if (isSyncMode) {
        return (
            <Progress
                current={progress.current}
                total={progress.total}
                contentFieldEnabled={progress.contentFieldEnabled ?? true}
                hasFinishedLoading={progress.hasFinishedLoading}
            />
        )
    }

    return (
        <ManageApp
            collection={collection}
            previousDatabaseId={previousDatabaseId}
            previousSlugFieldId={previousSlugFieldId}
            previousLastSynced={previousLastSynced}
            previousIgnoredFieldIds={previousIgnoredFieldIds}
            previousDatabaseName={previousDatabaseName}
            existingCollectionDatabaseIdMap={existingCollectionDatabaseIdMap}
        />
    )
}

function ManageApp({
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
    const [isSyncing, setIsSyncing] = useState(false)

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
                } else if (isSyncing) {
                    await showProgressUI()
                } else if (dataSource || isLoadingDataSource) {
                    await showFieldMappingUI()
                } else {
                    await showLoginUI()
                }
            } catch (error) {
                console.error(error)
                framer.notify(`Error opening plugin: ${error instanceof Error ? error.message : "Unknown error"}`, {
                    variant: "error",
                })
            }
        }

        void showUI()
    }, [dataSource, isLoadingDataSource, hasAccessError, isSyncing])

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
                        `Error loading previously configured database "${previousDatabaseName ?? previousDatabaseId}": ${error instanceof Error ? error.message : "Unknown error"}`,
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
            setIsSyncing={setIsSyncing}
        />
    )
}
