import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { PluginContext, useSheetQuery, useSyncSheetMutation } from "./sheets"
import { PLUGIN_LOG_SYNC_KEY, logSyncResult } from "./debug"

import { Authenticate } from "./pages/Authenticate"
import { MapSheetFieldsPage } from "./pages/MapSheetFields"
import { SelectSheetPage } from "./pages/SelectSheet"
import { CenteredSpinner } from "./components/CenteredSpinner"

interface AppProps {
    pluginContext: PluginContext
}

const useLoggingToggle = () => {
    useEffect(() => {
        const isLoggingEnabled = () => localStorage.getItem(PLUGIN_LOG_SYNC_KEY) === "true"

        const toggle = () => {
            const newState = !isLoggingEnabled()
            localStorage.setItem(PLUGIN_LOG_SYNC_KEY, newState ? "true" : "false")
            framer.notify(`Logging ${newState ? "enabled" : "disabled"}`, { variant: "info" })
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === "L") {
                e.preventDefault()
                toggle()
            }
        }

        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [])
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
            height: sheetTitle ? 425 : 355,
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
    useLoggingToggle()

    const [context, setContext] = useState(pluginContext)

    if (context.isAuthenticated) {
        return <AuthenticatedApp pluginContext={context} />
    }

    return <Authenticate onAuthenticated={setContext} />
}
