import { useState, useEffect } from "react"
import { CustomCode, framer } from "framer-plugin"
import { useUserQuery } from "../../../api"
import { Button } from "../../../components/Button"

const useCustomCode = () => {
    const [customCode, setCustomCode] = useState<CustomCode | null>(null)

    useEffect(() => framer.subscribeToCustomCode(setCustomCode), [])

    return customCode
}

const buildTrackingScript = (hubId: number) => {
    return `<script type="text/javascript" id="hs-script-loader" async defer src="//js-eu1.hs-scripts.com/${hubId}.js"></script>`
}

export const ToggleTrackingButton = ({ className }: { className?: string }) => {
    const customCode = useCustomCode()
    const { data: user, isLoading: isLoadingUser } = useUserQuery()
    const [isTrackingEnabled, setIsTrackingEnabled] = useState<boolean | null>(null)

    const trackingScript = buildTrackingScript(user?.hub_id ?? 0)

    useEffect(() => {
        if (!user) return

        const existingHtml = customCode?.bodyEnd.html
        const isEnabled = existingHtml?.includes(trackingScript)

        setIsTrackingEnabled(!!isEnabled)
    }, [customCode, user, trackingScript])

    const toggleTracking = () => {
        return framer.setCustomCode({
            location: "bodyEnd",
            html: isTrackingEnabled ? null : trackingScript,
        })
    }

    return (
        <Button
            variant={isTrackingEnabled ? "secondary" : "primary"}
            onClick={toggleTracking}
            isLoading={isLoadingUser}
            className={className}
        >
            {isTrackingEnabled ? "Disable" : "Enable"}
        </Button>
    )
}
