import { useLayoutEffect, useState } from "react"
import { getPluginContext, PluginContext, PluginContextNoSheetAccess } from "../sheets"
import { framer } from "framer-plugin"
import auth from "../auth"
import { Button } from "../components/Button"

interface Props {
    context: PluginContextNoSheetAccess
    setContext: (newContext: PluginContext) => void
}

export function NoSpreadsheetAccess({ context, setContext }: Props) {
    const [isRetrying, setIsRetrying] = useState(false)

    useLayoutEffect(() => {
        framer.showUI({
            width: 240,
            height: context.message === undefined ? 150 : 280,
            resizable: false,
        })
    }, [context.message])

    const handleViewClick = () => {
        window.open(context.sheetUrl, "_blank")
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
        <div className="flex flex-col h-full">
            <p className="text-content mb-[15px]">
                Your Google Account does not have access to the synced Google sheet. Retry or{" "}
                <a href="#" className="text-sheets-green" onClick={handleLogout}>
                    log out
                </a>{" "}
                of the Sheets Plugin, and log back in again.
            </p>
            {context.message !== undefined && <p className="text-content mb-[15px]">{context.message}</p>}
            <div className="grow"></div>
            <div className="mb-4 inline-flex items-center gap-[10px]">
                <Button variant="secondary" className="w-auto flex-1" onClick={handleRetryClick} isLoading={isRetrying}>
                    Retry
                </Button>
                {context.sheetUrl && (
                    <Button
                        className="w-auto flex-1 !bg-[#15C43E] text-white hover:bg-[#15C43E]"
                        onClick={handleViewClick}
                    >
                        View Sheet
                    </Button>
                )}
            </div>
        </div>
    )
}
