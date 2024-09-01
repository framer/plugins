import { Link } from "wouter"
import { ToggleTrackingButton } from "./components/ToggleTrackingButton"

export function Tracking() {
    return (
        <div className="col-lg">
            <p>
                By enabling tracking, you can monitor your site traffic via HubSpot and show chatbots on your site.
                <Link href="/tracking/learn-more"> Learn more</Link>.
            </p>
            <ToggleTrackingButton className="w-full" />
        </div>
    )
}
