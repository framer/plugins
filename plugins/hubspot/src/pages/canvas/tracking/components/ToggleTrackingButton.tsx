import { type CustomCode, framer, useIsAllowedTo } from "framer-plugin"
import { useEffect, useState } from "react"
import { useAccountQuery } from "../../../../api"
import { Button } from "../../../../components/Button"

const useCustomCode = () => {
    const [customCode, setCustomCode] = useState<CustomCode | null>(null)

    useEffect(() => framer.subscribeToCustomCode(setCustomCode), [])

    return customCode
}

const buildTrackingScript = (hubId: number, dataHostingLocation: string) => {
    return `<script type="text/javascript" id="hs-script-loader" async defer src="//js-${dataHostingLocation}.hs-scripts.com/${hubId}.js"></script>`
}

// Earlier versions always loaded the tracking script from the EU host, whatever the portal's region.
const LEGACY_DATA_HOSTING_LOCATION = "eu1"

export const ToggleTrackingButton = ({ className }: { className?: string }) => {
    const customCode = useCustomCode()
    const { data: account, isLoading: isLoadingAccount } = useAccountQuery()
    const [isTrackingEnabled, setIsTrackingEnabled] = useState<boolean | null>(null)
    const isAllowedToSetCustomCode = useIsAllowedTo("setCustomCode")

    const hubId = account?.portalId ?? 0
    const trackingScript = buildTrackingScript(hubId, account?.dataHostingLocation ?? LEGACY_DATA_HOSTING_LOCATION)
    const legacyTrackingScript = buildTrackingScript(hubId, LEGACY_DATA_HOSTING_LOCATION)

    useEffect(() => {
        if (!account) return

        const existingHtml = customCode?.bodyEnd.html
        const hasLegacyScript =
            trackingScript !== legacyTrackingScript && !!existingHtml?.includes(legacyTrackingScript)

        // Move sites that enabled tracking with the EU-only script onto their portal's own region.
        if (hasLegacyScript && isAllowedToSetCustomCode) {
            void framer.setCustomCode({ location: "bodyEnd", html: trackingScript })
        }

        setIsTrackingEnabled(!!existingHtml?.includes(trackingScript) || hasLegacyScript)
    }, [customCode, account, trackingScript, legacyTrackingScript, isAllowedToSetCustomCode])

    const toggleTracking = () =>
        void framer.setCustomCode({
            location: "bodyEnd",
            html: isTrackingEnabled ? null : trackingScript,
        })

    return (
        <Button
            variant={isTrackingEnabled ? "secondary" : "primary"}
            onClick={toggleTracking}
            isLoading={isLoadingAccount}
            className={className}
            disabled={!isAllowedToSetCustomCode}
            title={isAllowedToSetCustomCode ? undefined : "Insufficient permissions"}
        >
            {isTrackingEnabled ? "Disable" : "Enable"}
        </Button>
    )
}
