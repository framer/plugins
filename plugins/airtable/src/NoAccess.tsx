import { framer } from "framer-plugin"
import { useLayoutEffect, useState } from "react"
import auth from "./auth"

export function NoTableAccess({
    previousBaseId,
    previousTableId,
}: {
    previousBaseId: string | null
    previousTableId: string | null
}) {
    const [isRetrying, setIsRetrying] = useState(false)

    useLayoutEffect(() => {
        void framer.showUI({
            height: 110,
            width: 240,
            resizable: false,
        })
    }, [])

    const handleRetryClick = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        setIsRetrying(true)
        auth.authorize()
            .then(() => {
                setIsRetrying(false)
            })
            .catch((error: unknown) => {
                console.error(error)
                setIsRetrying(false)
            })
    }

    const handleLogout = () => {
        auth.logout()
        window.location.reload()
    }

    return (
        <form onSubmit={handleRetryClick}>
            <p>
                Your Airtable account does not have access to the synced table. Retry or{" "}
                {/* biome-ignore lint/a11y/useValidAnchor: Too much effort, as default <button> is too button-like */}
                <a href="#" style={{ color: "#27B5F8" }} onClick={handleLogout}>
                    log out
                </a>{" "}
                of the Airtable Plugin.
            </p>
            <div className="actions">
                <button type="submit" className="action-button">
                    {isRetrying ? <div className="framer-spinner" /> : "Retry"}
                </button>
                {previousBaseId && previousTableId && (
                    <button
                        type="button"
                        className="action-button"
                        style={{ color: "white", background: "#1D9CE7" }}
                        onClick={() => {
                            window.open(`https://airtable.com/${previousBaseId}/${previousTableId}`, "_blank")
                        }}
                    >
                        View Table
                    </button>
                )}
            </div>
        </form>
    )
}
