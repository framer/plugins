import { useState } from "react"
import auth from "./auth"

export function NoTableAccess({ previousDatabaseId }: { previousDatabaseId: string | null }) {
    const [isRetrying, setIsRetrying] = useState(false)

    const handleRetryClick = () => {
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
        <div className="no-access-container">
            <p>
                Your Notion account does not have access to the synced database. Retry or{" "}
                <a onClick={handleLogout}>log out</a> of the Notion plugin.
            </p>
            <div className="actions">
                <button className="action-button" onClick={handleRetryClick}>
                    {isRetrying ? <div className="framer-spinner" /> : "Retry"}
                </button>
                {previousDatabaseId && (
                    <a href={`https://notion.so/${previousDatabaseId?.replace(/-/g, "")}`} target="_blank">
                        <button className="action-button framer-button-primary">View Database</button>
                    </a>
                )}
            </div>
        </div>
    )
}
