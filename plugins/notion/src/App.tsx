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

export function AuthenticatedApp({ context }: { context: PluginContext }) {
    const [databaseConfig, setDatabaseConfig] = useState<GetDatabaseResponse | null>(() =>
        context.type === "new" ? null : context.database
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

    // TODO: Implement a screen with warnings and errors
    if (synchronizeMutation.data?.status === "completed_with_errors") {
        return (
            <div>
                Succeeded with errors:
                <div>{JSON.stringify(synchronizeMutation.data.errors, null, 2)}</div>
            </div>
        )
    }

    if (!databaseConfig) {
        return <SelectDatabase onDatabaseSelected={setDatabaseConfig} />
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
    const [isAuthenticated, setIsAuthenticated] = useState(context.isAuthenticated)
    const [appContext, setAppContext] = useState(context)

    const handleAuthenticated = (authenticatedContxt: PluginContext) => {
        setAppContext(authenticatedContxt)
        framer.showUI({
            width: 350,
            height: 369,
        })
        setIsAuthenticated(true)
    }

    if (!isAuthenticated) {
        return <Authentication onAuthenticated={handleAuthenticated} />
    }

    return <AuthenticatedApp context={appContext} />
}