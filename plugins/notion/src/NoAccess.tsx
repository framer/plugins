import { useLayoutEffect, useState } from "react"
import { framer } from "framer-plugin"
import auth from "./auth"

export function NoTableAccess({ previousDatabaseId }: { previousDatabaseId: string | null }) {
    const [isRetrying, setIsRetrying] = useState(false)

    useLayoutEffect(() => {
        framer.showUI({
            height: 110,
            width: 240,
            resizable: false,
        })
    }, [])

    const handleViewClick = () => {
        window.open("[add database url here]", "_blank")
    }

    const handleRetryClick = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        setIsRetrying(true)
        auth.authorize()
            .then(() => {
                setIsRetrying(false)
            })
            .catch(error => {
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
                Your Notion account does not have access to the synced table. Retry or{" "}
                <span style={{ color: "#27B5F8" }} onClick={handleLogout}>
                    log out
                </span>{" "}
                of the Notion plugin.
            </p>
            <div className="actions">
                <button className="action-button">{isRetrying ? <div className="framer-spinner" /> : "Retry"}</button>
                <button
                    type="button"
                    className="action-button"
                    style={{ color: "white", background: "#1D9CE7" }}
                    onClick={handleViewClick}
                >
                    View Database
                </button>
            </div>
        </form>
    )
}
