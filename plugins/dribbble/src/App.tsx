import { useEffect, useState } from "react"
import { getPluginContext, PluginContext, useSyncShotsMutation } from "./sync"
import { framer } from "framer-plugin"
import auth from "./auth"
import Authenticate from "./pages/Authenticate"
import MapFields from "./pages/MapFields"

export function AuthenticatedApp({ context }: { context: PluginContext }) {
    const syncMutation = useSyncShotsMutation({
        onSuccess: result => (result.status === "success" ? framer.closePlugin("Synchronization successful") : null),
        onError: e => framer.notify(e.message, { variant: "error" }),
    })

    useEffect(() => {
        framer.showUI({
            width: 340,
            height: 410,
        })
    }, [])

    return <MapFields context={context} onSubmit={syncMutation.mutate} isLoading={syncMutation.isPending} />
}

export function App({ context }: { context: PluginContext }) {
    const [pluginContext, setPluginContext] = useState(context)

    const handleAuthenticated = async () => {
        setPluginContext(await getPluginContext())
    }

    if (!auth.isAuthenticated()) {
        framer.showUI({
            width: 260,
            height: 345,
        })

        return <Authenticate onAuthenticated={handleAuthenticated} />
    }

    return <AuthenticatedApp context={pluginContext} />
}
