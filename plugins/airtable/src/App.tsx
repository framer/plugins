import { framer } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { PluginContext, PluginContextUpdate, syncTable } from "./airtable"
import { useBaseSchemaQuery, useSyncTableMutation } from "./api"
import { assert } from "./utils"
import { PLUGIN_LOG_SYNC_KEY, logSyncResult } from "./debug"
import { Authenticate } from "./pages/Authenticate"
import { MapTableFieldsPage } from "./pages/MapTableFields"
import { SelectTablePage } from "./pages/SelectTable"
import { CenteredSpinner } from "./components/CenteredSpinner"
import { NoTableAccess } from "./pages/NoTableAccess"

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
    const [baseId, setBaseId] = useState<string | null>(pluginContext.type === "update" ? pluginContext.baseId : null)
    const [tableId, setTableId] = useState<string | null>(
        pluginContext.type === "update" ? pluginContext.tableId : null
    )
    const { data: baseSchema, isPending } = useBaseSchemaQuery(baseId ?? "")

    const syncMutation = useSyncTableMutation({
        onSuccess: result => {
            logSyncResult(result)

            if (result.status === "success") {
                framer.closePlugin("Synchronization successful")
                return
            }
        },
        onError: e => framer.notify(e.message, { variant: "error" }),
    })

    useLayoutEffect(() => {
        framer.showUI({
            width: tableId ? 340 : 320,
            height: tableId ? 425 : 345,
        })
    }, [tableId])

    if (!tableId || !baseId) {
        return (
            <SelectTablePage
                onTableSelected={(selectedBaseId, selectedTableId) => {
                    setBaseId(selectedBaseId)
                    setTableId(selectedTableId)
                }}
            />
        )
    }

    if (isPending) return <CenteredSpinner />

    const tableSchema = baseSchema?.tables.find(table => table.id === tableId)
    assert(tableSchema, `Expected to find table schema for table with id: ${tableId}`)

    return (
        <MapTableFieldsPage
            baseId={baseId}
            tableId={tableId}
            pluginContext={pluginContext}
            onSubmit={syncMutation.mutate}
            isPending={syncMutation.isPending}
            tableSchema={tableSchema}
        />
    )
}

function shouldSyncImmediately(pluginContext: PluginContext): pluginContext is PluginContextUpdate {
    if (pluginContext.type !== "update") return false

    if (!pluginContext.slugFieldId) return false
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
        assert(context.slugFieldId !== null, "Expected slug field")

        framer.hideUI()

        const { baseId, tableId, collectionFields, ignoredFieldIds, slugFieldId, tableSchema, lastSyncedTime } = context

        syncTable({
            fields: collectionFields,
            ignoredFieldIds,
            lastSyncedTime,
            tableSchema,
            slugFieldId,
            baseId,
            tableId,
        }).then(() => framer.closePlugin())
    }, [context, shouldSyncOnly])

    if (shouldSyncOnly) return null

    if (context.type === "no-table-access") {
        return <NoTableAccess context={context} setContext={setContext} />
    }

    if (context.isAuthenticated) {
        return <AuthenticatedApp pluginContext={context} />
    }

    return <Authenticate onAuthenticated={setContext} />
}
