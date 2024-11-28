import { PublishInfo, framer } from "framer-plugin"
import { useState, useEffect } from "react"

export const usePublishInfo = () => {
    const [publishInfo, setPublishInfo] = useState<PublishInfo>()

    useEffect(() => framer.subscribeToPublishInfo(setPublishInfo), [])

    return publishInfo
}
