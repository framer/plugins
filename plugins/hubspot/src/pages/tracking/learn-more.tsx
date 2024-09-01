import { ToggleTrackingButton } from "./components/ToggleTrackingButton"

export function LearnMoreTrackingPage() {
    return (
        <div className="col-lg">
            <p>
                The HubSpot tracking code is unique to each HubSpot account and allows HubSpot to monitor your website
                traffic, identify visitors, track events, CTAs and more. <br />
                You can learn more about tracking{" "}
                <a href="https://knowledge.hubspot.com/reports/install-the-hubspot-tracking-code" target="_blank">
                    here
                </a>
                .
            </p>
            <div className="row">
                <button className="flex-1" onClick={history.back}>
                    Back
                </button>
                <ToggleTrackingButton className="flex-1" />
            </div>
        </div>
    )
}
