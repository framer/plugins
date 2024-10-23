import { useLayoutEffect, useState } from "react"
import { getPluginContext, PluginContext, PluginContextNoTableAccess } from "../airtable"
import { framer } from "framer-plugin"
import auth from "../auth"
import { Button } from "../components/Button"

interface Props {
    context: PluginContextNoTableAccess
    setContext: (newContext: PluginContext) => void
}

export function NoTableAccess({ context, setContext }: Props) {
    const [isRetrying, setIsRetrying] = useState(false)

    useLayoutEffect(() => {
        framer.showUI({
            height: 110,
            width: 240,
            resizable: false,
        })
    }, [])

    const handleViewClick = () => {
        window.open(context.tableUrl, "_blank")
    }

    const handleRetryClick = () => {
        setIsRetrying(true)

        getPluginContext()
            .then(setContext)
            .finally(() => setIsRetrying(false))
    }

    const handleLogout = () => {
        auth.logout()

        getPluginContext().then(setContext)
    }

    return (
        <div className="flex flex-col gap-[15px]">
            <p className="text-content">
                Your Airtable account does not have access to the synced table. Retry or{" "}
                <a href="#" className="text-airtable-blue" onClick={handleLogout}>
                    log out
                </a>{" "}
                of the Sheets Plugin.
            </p>
            <div className="inline-flex items-center gap-[10px]">
                <Button variant="secondary" className="w-auto flex-1" onClick={handleRetryClick} isLoading={isRetrying}>
                    Retry
                </Button>
                <Button className="w-auto flex-1 !bg-[#15C43E] text-white hover:bg-[#15C43E]" onClick={handleViewClick}>
                    View Sheet
                </Button>
            </div>
        </div>
    )
}
