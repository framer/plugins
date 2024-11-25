import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import "./App.css"
import { PluginContext, PluginContextNew, PluginContextUpdate, useSynchronizeDatabaseMutation } from "./notion"

import { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints"
import { SelectDatabase } from "./SelectDatabase"
import { MapDatabaseFields } from "./MapFields"
import { logSyncResult } from "./debug"
import { Authentication } from "./Authenticate"

interface AppProps {
    context: PluginContext
}

interface AuthenticatedAppProps {
    context: PluginContextNew | PluginContextUpdate
}

export function AuthenticatedApp({ context }: AuthenticatedAppProps) {
    const [databaseConfig, setDatabaseConfig] = useState<GetDatabaseResponse | null>(
        context.type === "update" ? context.database : null
    )

    useEffect(() => {
        const width = databaseConfig ? 360 : 325
        const height = databaseConfig ? 425 : 370
        framer.showUI({
            width,
            height,
            minWidth: width,
            minHeight: height,
            // Only allow resizing when mapping fields as the default size could not be enough.
            // This will keep the given dimensions in the Splash Screen.
            resizable: Boolean(databaseConfig),
        })
    }, [databaseConfig])

    const synchronizeMutation = useSynchronizeDatabaseMutation(databaseConfig, {
        onError(error) {
            framer.notify(error.message, { variant: "error" })
        },
        onSuccess(result) {
            logSyncResult(result)

            if (result.status === "success") {
                framer.closePlugin("Synchronization successful")
                return
            }
        },
    })

    const handleDatabaseSelected = (database: GetDatabaseResponse) => {
        context.databaseIdMap.set(database.id, context.collection.id)
        setDatabaseConfig(database)
    }

    if (!databaseConfig) {
        return <SelectDatabase onDatabaseSelected={handleDatabaseSelected} />
    }

    return (
        <MapDatabaseFields
            database={databaseConfig}
            pluginContext={context}
            onSubmit={synchronizeMutation.mutate}
            isLoading={synchronizeMutation.isPending}
        />
    )
}

export function App({ context }: AppProps) {
    const [pluginContext, setPluginContext] = useState(context)

    const handleAuthenticated = (authenticatedContext: PluginContext) => {
        setPluginContext(authenticatedContext)
    }

    if (!pluginContext.isAuthenticated) {
        return <Authentication context={pluginContext} onAuthenticated={handleAuthenticated} />
    }

    return <AuthenticatedApp context={pluginContext} />
}
