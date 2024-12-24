import { useEffect, useState } from "react"
import classNames from "classnames"
import { useLocation } from "wouter"
import { ExternalLink } from "@/components/Link"
import { useSavedMarketingId } from "./hooks/useSavedMarketingId"
import { useCustomCode } from "@/hooks/useCustomCode"
import { framer } from "framer-plugin"
import { CenteredSpinner } from "@/components/CenteredSpinner"

const buildTrackingScript = (mid: string) => ({
    headEndHTML: `<script type="text/javascript" src="https://${mid}.collect.igodigital.com/collect.js"></script>`,
    bodyEndHTML: `<script type="text/javascript">_etmc.push(["setOrgId", "${mid}"]);_etmc.push(["trackPageView"]);</script>`,
})

export default function Tracking() {
    const customCode = useCustomCode()
    const [, navigate] = useLocation()
    const [isTrackingEnabled, setIsTrackingEnabled] = useState(false)
    const [savedMarketingId] = useSavedMarketingId()

    useEffect(() => {
        if (!savedMarketingId) return

        const { headEndHTML, bodyEndHTML } = buildTrackingScript(savedMarketingId)
        const isEnabled =
            customCode?.headEnd.html?.includes(headEndHTML) && customCode?.bodyEnd.html?.includes(bodyEndHTML)

        setIsTrackingEnabled(!!isEnabled)
    }, [customCode, savedMarketingId])

    const handleToggleTracking = async () => {
        setIsTrackingEnabled(true)

        if (!savedMarketingId) return

        const { headEndHTML, bodyEndHTML } = buildTrackingScript(savedMarketingId)

        await framer.setCustomCode({
            location: "headEnd",
            html: isTrackingEnabled ? null : headEndHTML,
        })

        await framer.setCustomCode({
            location: "bodyEnd",
            html: isTrackingEnabled ? null : bodyEndHTML,
        })
    }

    if (savedMarketingId === null) return <CenteredSpinner />

    return (
        <main>
            <p>
                By installing the Collect Tracking Code, you can monitor visitor interactions and activities on your
                site. Learn more{" "}
                <ExternalLink href="https://help.salesforce.com/s/articleView?id=mktg.mc_ctc_collect_code.htm&type=5">
                    here
                </ExternalLink>
                .
            </p>
            {savedMarketingId ? (
                <button
                    className={classNames({ "framer-button-primary": !isTrackingEnabled })}
                    onClick={handleToggleTracking}
                >
                    {isTrackingEnabled ? "Disable" : "Enable"}
                </button>
            ) : (
                <button onClick={() => navigate("/tracking/mid")} className="framer-button-primary">
                    Get Started
                </button>
            )}
        </main>
    )
}
