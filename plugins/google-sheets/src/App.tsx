import { framer } from "framer-plugin"
import { useState } from "react"
import { PluginContext, useSheetQuery, useSyncSheetMutation } from "./sheets"
import { logSyncResult } from "./debug"
import { assert } from "./utils"

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
        onError: (e: Error) => framer.notify(e.message, { variant: "error" }),
    })

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
    assert(headerRow, "Expected a header row to be present in the sheet.")

    framer.showUI({
        width: 340,
        height: 425,
    })

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

    return <Authenticate onAuthenticated={setContext} context={context} />
}
