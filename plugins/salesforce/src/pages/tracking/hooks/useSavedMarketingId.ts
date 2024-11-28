import { framer } from "framer-plugin"
import { useEffect, useState } from "react"

const MID_PLUGIN_KEY = "marketingId"

export const useSavedMarketingId = () => {
    const [savedMarketingId, setSavedMarketingId] = useState<string | null>(null)

    useEffect(() => {
        const loadMarketingId = async () => {
            const storedId = await framer.getPluginData(MID_PLUGIN_KEY)
            if (storedId) {
                setSavedMarketingId(storedId)
            } else {
                setSavedMarketingId("")
            }
        }

        loadMarketingId()
    }, [])

    const setMarketingId = async (newId: string) => {
        try {
            await fetch(`https://${newId}.collect.igodigital.com/collect.js`, { method: "HEAD" })
            setSavedMarketingId(newId)
            await framer.setPluginData(MID_PLUGIN_KEY, newId)
            framer.notify("MID saved", { variant: "success" })
        } catch {
            framer.notify("Invalid MID", { variant: "error" })
        }
    }

    return [savedMarketingId, setMarketingId] as const
}
