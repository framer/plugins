import "./App.css"

import { framer, type ManagedCollection, type ManagedCollectionFieldInput } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import auth from "./auth"
import { type DataSource, getDataSource } from "./data"
import { FieldMapping } from "./FieldMapping"
import { SelectDataSource } from "./SelectDataSource"
import { fetchSpreadsheetInfo, useSheetQuery } from "./sheets"
import { showAccessErrorUI, showFieldMappingUI, showLoginUI } from "./ui"

interface AppProps {
    collection: ManagedCollection
    collectionFields: ManagedCollectionFieldInput[]
    previousSpreadsheetId: string | null
    previousSheetId: string | null
    previousSlugFieldId: string | null
    previousLastSynced: string | null
    previousIgnoredColumns: string | null
    previousSheetHeaderRowHash: string | null
}

export function App({
    collection,
    collectionFields,
    previousSpreadsheetId,
    previousSheetId,
    previousSlugFieldId,
    previousLastSynced,
    previousIgnoredColumns,
    previousSheetHeaderRowHash,
}: AppProps) {
    const [dataSource, setDataSource] = useState<DataSource | null>(null)
    const [isLoadingDataSource, setIsLoadingDataSource] = useState(Boolean(previousSheetId && previousSpreadsheetId))

    const { data: sheet, isPending: isSheetPending } = useSheetQuery(dataSource?.id ?? "", dataSource?.sheetTitle ?? "")

    const isSheetLoading = dataSource && isSheetPending

    useLayoutEffect(() => {
        const showUI = async () => {
            const hasAccessError = false

            try {
                if (hasAccessError) {
                    await showAccessErrorUI()
                } else if (dataSource || isSheetLoading) {
                    await showFieldMappingUI()
                } else {
                    await showLoginUI()
                }
            } catch (error) {
                console.error(error)
                framer.notify(`Error opening plugin. Check the logs for more details.`, { variant: "error" })
            }
        }

        showUI()
    }, [dataSource])

    useEffect(() => {
        if (!previousSpreadsheetId || !previousSheetId) {
            return
        }

        const abortController = new AbortController()

        setIsLoadingDataSource(true)

        // First fetch spreadsheet info to get the sheet title from the sheet ID
        fetchSpreadsheetInfo(previousSpreadsheetId)
            .then(spreadsheetInfo => {
                if (abortController.signal.aborted) return

                const sheetTitle = spreadsheetInfo.sheets.find(
                    sheet => sheet.properties.sheetId === parseInt(previousSheetId)
                )?.properties.title

                if (!sheetTitle) {
                    throw new Error(`Sheet with ID ${previousSheetId} not found in spreadsheet`)
                }

                return getDataSource(previousSpreadsheetId, sheetTitle)
            })
            .then(dataSource => {
                if (abortController.signal.aborted) return

                if (dataSource) {
                    setDataSource(dataSource)
                } else {
                    throw new Error(`Sheet with ID ${previousSheetId} not found in spreadsheet`)
                }
            })
            .catch(error => {
                if (abortController.signal.aborted) return

                console.error(error)
                framer.notify(`Error loading previously sheet. Check the logs for more details.`, { variant: "error" })
            })
            .finally(() => {
                if (abortController.signal.aborted) return

                setIsLoadingDataSource(false)
            })

        return () => abortController.abort()
    }, [previousSpreadsheetId, previousSheetId])

    useEffect(() => {
        framer.setMenu([
            {
                label: "View in Google Sheets",
                visible: Boolean(dataSource?.id),
                onAction: () => {
                    if (!dataSource?.id) return
                    window.open(`https://docs.google.com/spreadsheets/d/${dataSource.id}/edit`, "_blank")
                },
            },
            { type: "separator" },
            {
                label: "Log Out",
                onAction: async () => {
                    await auth.logout()
                },
            },
        ])
    }, [dataSource])

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
            </main>
        )
    }

    if (!sheet?.values || sheet.values.length === 0) {
        framer.notify("Failed to load sheet. Check the logs for more details.", { variant: "error" })
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
