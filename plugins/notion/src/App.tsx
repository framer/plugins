import { framer } from "framer-plugin"
import { useState } from "react"
import "./App.css"
import { PluginContext, useSynchronizeDatabaseMutation } from "./notion"

import { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints"
import { SelectDatabase } from "./SelectDatabase"
import { MapDatabaseFields } from "./MapFields"
import { logSyncResult } from "./debug"
import { Authentication } from "./Authenticate"

interface AppProps {
    context: PluginContext
}

export function AuthenticatedApp({ context }: AppProps) {
    const [databaseConfig, setDatabaseConfig] = useState<GetDatabaseResponse | null>(
        context.type === "update" ? context.database : null
    )

    const synchronizeMutation = useSynchronizeDatabaseMutation(databaseConfig, {
        onSuccess(result) {
            logSyncResult(result)

            if (result.status === "success") {
                framer.closePlugin("Synchronization successful")
                return
            }
        },
    })

    if (!databaseConfig) {
        return <SelectDatabase onDatabaseSelected={setDatabaseConfig} />
    }

    return (
        <MapDatabaseFields
            database={databaseConfig}
            pluginContext={context}
            onSubmit={synchronizeMutation.mutate}
            error={synchronizeMutation.error}
            isLoading={synchronizeMutation.isPending}
        />
    )
}

export function App({ context }: AppProps) {
    const [pluginContext, setPluginContext] = useState(context)

    const handleAuthenticated = (authenticatedContext: PluginContext) => {
        setPluginContext(authenticatedContext)

        // The authenticated UI is larger in size than the authentication screen.
        framer.showUI({
            width: 350,
            height: 370,
        })
    }

    if (!pluginContext.isAuthenticated) {
        return <Authentication context={pluginContext} onAuthenticated={handleAuthenticated} />
    }

    return <AuthenticatedApp context={pluginContext} />
}
