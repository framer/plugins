import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { PluginContext, useSheetQuery, useSyncSheetMutation } from "./sheets"
import { logSyncResult } from "./debug"

import { Authenticate } from "./pages/Authenticate"
import { MapSheetFieldsPage } from "./pages/MapSheetFields"
import { SelectSheetPage } from "./pages/SelectSheet"
import { CenteredSpinner } from "./components/CenteredSpinner"

interface AppProps {
    pluginContext: PluginContext
}

export function AuthenticatedApp({ pluginContext }: AppProps) {
    const [spreadsheetId, setSpreadsheetId] = useState<string | null>(
        pluginContext.type === "update" ? pluginContext.spreadsheetId : null
    )
    const [sheetTitle, setSheetTitle] = useState<string | null>(
        pluginContext.type === "update" ? pluginContext.sheetTitle : null
    )
    const { data: sheet, isPending: isSheetPending } = useSheetQuery(spreadsheetId ?? "", sheetTitle ?? "")

    const syncMutation = useSyncSheetMutation({
        onSuccess: result => {
            logSyncResult(result)

            if (result.status === "success") {
                framer.closePlugin("Synchronization successful")
                return
            }
        },
        onError: e => framer.notify(e.message, { variant: "error" }),
    })

    useEffect(() => {
        framer.showUI({
            width: sheetTitle ? 340 : 320,
            height: sheetTitle ? 425 : 345,
        })
    }, [sheetTitle])

    if (!spreadsheetId || !sheetTitle) {
        return (
            <SelectSheetPage
                onSheetSelected={(selectedSpreadsheetId, selectedSheetTitle) => {
                    setSpreadsheetId(selectedSpreadsheetId)
                    setSheetTitle(selectedSheetTitle)
                }}
            />
        )
    }

    if (isSheetPending) return <CenteredSpinner />

    const [headerRow, ...rows] = sheet?.values ?? []
    if (!headerRow) {
        throw new Error("The provided sheet requires at least one row")
    }

    return (
        <MapSheetFieldsPage
            spreadsheetId={spreadsheetId}
            sheetTitle={sheetTitle}
            headerRow={headerRow}
            pluginContext={pluginContext}
            onSubmit={syncMutation.mutate}
            isPending={syncMutation.isPending}
            rows={rows}
        />
    )
}

export function App({ pluginContext }: AppProps) {
    const [context, setContext] = useState(pluginContext)

    if (context.isAuthenticated) {
        return <AuthenticatedApp pluginContext={context} />
    }

    return <Authenticate onAuthenticated={setContext} />
}
