import { framer } from "framer-plugin"
import { type PropsWithChildren, useLayoutEffect, useState } from "react"
import { Button } from "../components/Button"
import { getPluginContext, type PluginContext } from "../sheets"

interface Props extends PropsWithChildren {
    height: number
    spreadsheetId: string
    setContext: (newContext: PluginContext) => void
}

export function Problem({ height, spreadsheetId, setContext, children }: Props) {
    const [isRetrying, setIsRetrying] = useState(false)

    useLayoutEffect(() => {
        void framer.showUI({
            width: 240,
            height,
            resizable: false,
        })
    }, [height])

    const handleOpenClick = () => {
        window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, "_blank")
    }

    const handleRetryClick = () => {
        setIsRetrying(true)

        const task = async () => {
            try {
                const context = await getPluginContext()
                setContext(context)
            } finally {
                setIsRetrying(false)
            }
        }

        void task()
    }

    return (
        <div className="flex flex-col gap-[15px]">
            {children}
            <div className="inline-flex items-center gap-[10px]">
                <Button variant="secondary" className="w-auto flex-1" onClick={handleRetryClick} isLoading={isRetrying}>
                    Retry
                </Button>
                {spreadsheetId && (
                    <Button
                        className="w-auto flex-1 bg-[#15C43E]! text-white hover:bg-[#15C43E]"
                        onClick={handleOpenClick}
                    >
                        Open Sheet
                    </Button>
                )}
            </div>
        </div>
    )
}
