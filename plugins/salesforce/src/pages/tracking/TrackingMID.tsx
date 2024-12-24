import { useSavedMarketingId } from "./hooks/useSavedMarketingId"
import { useState } from "react"

export default function TrackingMID() {
    const [, setSavedMarketingId] = useSavedMarketingId()
    const [inputMarketingId, setInputMarketingId] = useState("")

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputMarketingId) return

        setSavedMarketingId(inputMarketingId)
    }

    return (
        <main>
            <p>Log in to Marketing Cloud and hover over your account name in the upper-right corner.</p>
            <form onSubmit={handleSave}>
                <input
                    type="text"
                    value={inputMarketingId}
                    onChange={e => setInputMarketingId(e.target.value)}
                    placeholder="Marketing ID"
                    className="w-full"
                />
            </form>
            <button className="framer-button-primary" onClick={handleSave}>
                Save
            </button>
        </main>
    )
}
