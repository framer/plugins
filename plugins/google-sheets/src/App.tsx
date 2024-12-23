import { framer } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import {
    getPluginContext,
    PluginContext,
    PluginContextUpdate,
    syncSheet,
    useFetchUserInfo,
    useSheetQuery,
    useSyncSheetMutation,
} from "./sheets"
import { PLUGIN_LOG_SYNC_KEY, logSyncResult } from "./debug"

import { Authenticate } from "./pages/Authenticate"
import { MapSheetFieldsPage } from "./pages/MapSheetFields"
import { SelectSheetPage } from "./pages/SelectSheet"
import { CenteredSpinner } from "./components/CenteredSpinner"
import { Problem } from "./pages/Problem"
import { assert } from "./utils"
import auth from "./auth"

interface AppProps {
    pluginContext: PluginContext
}

interface AuthenticatedAppProps extends AppProps {
    setContext: (newContext: PluginContext) => void
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

export function AuthenticatedApp({ pluginContext, setContext }: AuthenticatedAppProps) {
    const [spreadsheetId, setSpreadsheetId] = useState<string | null>(
        pluginContext.type === "update" ? pluginContext.spreadsheetId : null
    )
    const [sheetTitle, setSheetTitle] = useState<string | null>(
        pluginContext.type === "update" ? pluginContext.sheetTitle : null
    )
    const [isSelectSheetError, setIsSelectSheetError] = useState(false)

    const { isError: isUserInfoError } = useFetchUserInfo()

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
        if (isUserInfoError || isSelectSheetError) {
            setContext({
                type: "no-sheet-access",
                spreadsheetId: "",
            })
        }
    }, [isUserInfoError, isSelectSheetError, setContext])

    useLayoutEffect(() => {
        const width = sheetTitle !== null ? 360 : 320
        const height = sheetTitle !== null ? 425 : 345

        framer.showUI({
            width,
            height,
            minWidth: width,
            minHeight: height,
            // Only allow resizing when mapping fields as the default size could not be enough.
            // This will keep the given dimensions in the Select Sheet Screen.
            resizable: sheetTitle !== null,
        })
    }, [sheetTitle])

    if (!spreadsheetId || sheetTitle === null) {
        return (
            <SelectSheetPage
                onError={() => setIsSelectSheetError(true)}
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

function shouldSyncImmediately(pluginContext: PluginContext): pluginContext is PluginContextUpdate {
    if (pluginContext.type !== "update") return false
    if (pluginContext.slugColumn === null) return false
    if (pluginContext.hasChangedFields) return false

    return true
}

export function App({ pluginContext }: AppProps) {
    useLoggingToggle()

    const [context, setContext] = useState(pluginContext)
    const mode = framer.mode

    const shouldSyncOnly = mode === "syncManagedCollection" && shouldSyncImmediately(context)
    useLayoutEffect(() => {
        if (!shouldSyncOnly) return
        assert(context.type === "update")
        assert(context.slugColumn !== null, "Expected slug column")

        framer.hideUI()

        const {
            spreadsheetId,
            sheetTitle,
            collectionFields: fields,
            ignoredColumns,
            slugColumn,
            lastSyncedTime,
            sheet,
        } = context
        const [headerRow] = sheet.values

        syncSheet({
            ignoredColumns,
            slugColumn,
            fetchedSheet: sheet,
            lastSyncedTime,
            spreadsheetId,
            sheetTitle,
            fields,
            // Determine if the field type is already configured, otherwise default to "string"
            colFieldTypes: headerRow.map(colName => {
                const field = fields.find(field => field?.name === colName)
                return field?.type ?? "string"
            }),
        }).then(() => framer.closePlugin())
    }, [context, shouldSyncOnly])

    if (shouldSyncOnly) return null

    if (context.type === "no-sheet-access") {
        return (
            <Problem height={132} spreadsheetId={context.spreadsheetId} setContext={setContext}>
                <p className="text-content">
                    Your Google Account does not have access to the synced spreadsheet. Check your access and try again
                    or{" "}
                    <a
                        href="#"
                        className="text-sheets-green"
                        onClick={() => {
                            auth.logout()
                            getPluginContext().then(setContext)
                        }}
                    >
                        log out
                    </a>{" "}
                    and try a different account.
                </p>
            </Problem>
        )
    }

    if (context.type === "sheet-by-title-missing") {
        return (
            <Problem height={157} spreadsheetId={context.spreadsheetId} setContext={setContext}>
                <p className="text-content">
                    Unable to access the synced sheet:{" "}
                    <div
                        className="my-1 font-black truncate cursor-pointer"
                        title="Click to copy"
                        onClick={() => {
                            navigator.clipboard.writeText(context.title)
                            framer.notify("Sheet title copied")
                        }}
                    >
                        {context.title}
                    </div>{" "}
                    If the sheet was recently renamed, temporarily revert to the previous name, retry, then update the
                    name.
                </p>
            </Problem>
        )
    }

    if (context.isAuthenticated) {
        return <AuthenticatedApp pluginContext={context} setContext={setContext} />
    }

    return <Authenticate onAuthenticated={setContext} />
}
