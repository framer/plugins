import { Link } from "wouter"
import { ToggleTrackingButton } from "./components/ToggleTrackingButton"

export default function Tracking() {
    return (
        <main>
            <p>
                By enabling tracking, you can monitor your site traffic via HubSpot and show chatbots on your site.
                <Link href="/canvas/tracking/learn-more"> Learn more</Link>.
            </p>
            <ToggleTrackingButton className="w-full" />
        </main>
    )
}
