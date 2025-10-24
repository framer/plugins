import { framer } from "framer-plugin"
import { type PropsWithChildren, useLayoutEffect, useState } from "react"
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
        <main className="flex flex-col gap-[15px] select-none h-full justify-between pb-[15px]">
            {children}
            <div className="inline-flex items-center gap-[10px]">
                <button className="flex-1" onClick={handleRetryClick}>
                    {isRetrying ? <div className="framer-spinner" /> : "Retry"}
                </button>
                {spreadsheetId && (
                    <button className="framer-button-primary flex-1" onClick={handleOpenClick}>
                        Open Sheet
                    </button>
                )}
            </div>
        </main>
    )
}
