import plus from "../images/Plus@2x.png"
import type { SiteWithGoogleSite } from "../types"

interface NeedsVerifyProps {
    retry: () => void
    logout: () => void
    site: SiteWithGoogleSite
}

export default function NeedsVerify({ retry, logout, site }: NeedsVerifyProps) {
    return (
        <div className="interstitial">
            <div className="interstitial-content">
                <img className="img-plus" src={plus} alt="" />
                <div>
                    <p className="interstitial-title">Verify your site</p>
                    <p>
                        Next, let’s add your site to the Google Search Console. Verify via the HTML tag, then click
                        Retry.
                    </p>
                </div>
            </div>
            <section className="actions-footer actions-footer--vertical">
                <button className="framer-button-primary" type="button" onClick={retry}>
                    Retry
                </button>
                <button
                    type="button"
                    onClick={() => {
                        window.open(
                            `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(site.googleSite.siteUrl || site.url)}`,
                            "_blank"
                        )
                    }}
                >
                    Open Dashboard
                </button>
                <button type="button" onClick={logout}>
                    Log Out
                </button>
            </section>
        </div>
    )
}
