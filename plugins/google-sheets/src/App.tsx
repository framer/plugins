import { framer } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import auth from "./auth"
import { logSyncResult, PLUGIN_LOG_SYNC_KEY } from "./debug"
import { Authenticate } from "./pages/Authenticate"
import { MapSheetFieldsPage } from "./pages/MapSheetFields"
import { Problem } from "./pages/Problem"
import { SelectSheetPage } from "./pages/SelectSheet"
import {
    type PluginContext,
    type PluginContextUpdate,
    syncSheet,
    useFetchUserInfo,
    useSheetQuery,
    useSyncSheetMutation,
} from "./sheets"
import { showFieldMappingUI, showLoginUI } from "./ui"
import { assert, syncMethods } from "./utils"

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
    const [selectSheetError, setSelectSheetError] = useState<{
        errorStatus?: string
        errorMessage?: string
    } | null>(null)

    const { isError: isUserInfoError } = useFetchUserInfo()

    const { data: sheet, isPending: isSheetPending } = useSheetQuery(spreadsheetId ?? "", sheetTitle ?? "")

    const hasSheet = Boolean(spreadsheetId && sheetTitle)

    const syncMutation = useSyncSheetMutation({
        onSuccess: result => {
            logSyncResult(result)

            if (result.status === "success") {
                framer.closePlugin("Synchronization successful")
            }
        },
        onError: e => framer.notify(e.message, { variant: "error", durationMs: Infinity }),
    })

    useEffect(() => {
        if (isUserInfoError || selectSheetError) {
            setContext({
                type: "no-sheet-access",
                spreadsheetId: "",
                errorStatus: selectSheetError?.errorStatus,
                errorMessage: selectSheetError?.errorMessage,
            })
        }
    }, [isUserInfoError, selectSheetError, setContext])

    useLayoutEffect(() => {
        const showUI = async () => {
            try {
                if (hasSheet) {
                    await showFieldMappingUI()
                } else {
                    await showLoginUI()
                }
            } catch (error) {
                console.error(error)
                framer.notify("Failed to open plugin. Check the logs for more details.", { variant: "error" })
            }
        }

        void showUI()
    }, [sheetTitle, hasSheet, isSheetPending])

    useEffect(() => {
        framer
            .setMenu([
                {
                    label: `View ${sheetTitle ?? ""} in Google Sheets`,
                    visible: Boolean(spreadsheetId),
                    onAction: () => {
                        if (!spreadsheetId) return
                        window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, "_blank")
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
            .catch((e: unknown) => {
                console.error(e)
            })
    }, [sheetTitle, spreadsheetId])

    if (!spreadsheetId || sheetTitle === null) {
        return (
            <SelectSheetPage
                onError={(errorStatus, errorMessage) => {
                    setSelectSheetError({ errorStatus, errorMessage })
                }}
                onSheetSelected={(selectedSpreadsheetId, selectedSheetTitle) => {
                    setSpreadsheetId(selectedSpreadsheetId)
                    setSheetTitle(selectedSheetTitle)
                }}
            />
        )
    }

    if (isSheetPending) {
        return (
            <main className="size-full flex items-center justify-center select-none">
                <div className="framer-spinner" />
            </main>
        )
    }

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

    // Not a hook because we don't want to re-run the effect
    const isAllowedToSync = framer.isAllowedTo(...syncMethods)
    const shouldSyncOnly = mode === "syncManagedCollection" && shouldSyncImmediately(context) && isAllowedToSync

    useLayoutEffect(() => {
        if (!shouldSyncOnly) return
        assert(context.slugColumn !== null, "Expected slug column")

        void framer.hideUI()

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

        const task = async () => {
            try {
                await syncSheet({
                    ignoredColumns,
                    slugColumn,
                    fetchedSheet: sheet,
                    lastSyncedTime,
                    spreadsheetId,
                    sheetTitle,
                    fields,
                    // Determine if the field type is already configured, otherwise default to "string"
                    colFieldTypes: headerRow.map(colName => {
                        const field = fields.find(field => field.name === colName)
                        return field?.type ?? "string"
                    }),
                })

                framer.closePlugin("Synchronization successful", { variant: "success" })
            } catch (error) {
                console.error(error)
                framer.closePlugin(
                    error instanceof Error ? error.message : "An error occurred while syncing the sheet",
                    { variant: "error" }
                )
            }
        }

        void task()
    }, [context, shouldSyncOnly])

    if (shouldSyncOnly) return null

    if (context.type === "no-sheet-access") {
        let errorContent: React.ReactNode
        let height = 150

        if (context.errorStatus === "FAILED_PRECONDITION") {
            height = 132
            errorContent = (
                <>
                    This is an unsupported sheet. Office/Excel files are not supported. Please use a regular Google
                    Sheet instead.
                </>
            )
        } else if (context.errorStatus === "PERMISSION_DENIED") {
            height = 132
            errorContent = (
                <>
                    Your Google Account does not have access to the synced spreadsheet. Check your access and try again
                    or{" "}
                    <a href="#" onClick={() => void auth.logout()}>
                        log out
                    </a>{" "}
                    and try a different account.
                </>
            )
        } else if (context.errorMessage) {
            errorContent = <>An error occurred while accessing the spreadsheet: {context.errorMessage}</>
        } else {
            height = 114
            errorContent = (
                <>An error occurred while accessing the spreadsheet. Please try again or select a different sheet.</>
            )
        }

        return (
            <Problem height={height} spreadsheetId={context.spreadsheetId} setContext={setContext}>
                {errorContent}
            </Problem>
        )
    }

    if (context.type === "sheet-by-title-missing") {
        return (
            <Problem height={157} spreadsheetId={context.spreadsheetId} setContext={setContext}>
                Unable to access the synced sheet:{" "}
                <div
                    className="my-1 font-black truncate cursor-pointer"
                    title="Click to copy"
                    onClick={() =>
                        void navigator.clipboard.writeText(context.title).then(() => {
                            framer.notify("Sheet title copied")
                        })
                    }
                >
                    {context.title}
                </div>{" "}
                If the sheet was recently renamed, temporarily revert to the previous name, retry, then update the name.
            </Problem>
        )
    }

    if (context.isAuthenticated) {
        return <AuthenticatedApp pluginContext={context} setContext={setContext} />
    }

    return <Authenticate onAuthenticated={setContext} />
}
