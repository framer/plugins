import { useState } from "react"
import auth from "./auth"

export function NoTableAccess({ previousDatabaseId }: { previousDatabaseId: string | null }) {
    const [isRetrying, setIsRetrying] = useState(false)

    const handleRetryClick = () => {
        setIsRetrying(true)
        auth.authorize()
            .catch(error => {
                console.error(error)
            })
            .finally(() => {
                setIsRetrying(false)
            })
    }

    const handleLogout = async () => {
        await auth.logout()
    }

    return (
        <div className="no-access-container">
            <p>
                Your Google account does not have access to the synced sheet. Retry or{" "}
                <a onClick={handleLogout}>log out</a> of the Google Sheets plugin.
            </p>
            <div className="actions">
                <button className="action-button" onClick={handleRetryClick}>
                    {isRetrying ? <div className="framer-spinner" /> : "Retry"}
                </button>
                {previousDatabaseId && (
                    <a href={`https://notion.so/${previousDatabaseId?.replace(/-/g, "")}`} target="_blank">
                        <button className="action-button framer-button-primary">View Sheet</button>
                    </a>
                )}
            </div>
        </div>
    )
}
