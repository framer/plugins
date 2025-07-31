import plus from "../images/Plus@2x.png"
import type { Site } from "../types"

interface CriticalErrorProps {
    site: Site
    logout: () => void
}

export default function CriticalError({ site, logout }: CriticalErrorProps) {
    return (
        <div className="interstitial">
            <div className="interstitial-content">
                <img className="img-plus" src={plus} alt="" />
                <div>
                    <p className="interstitial-title">Add your website</p>
                    <p>
                        Next, let’s add your site to the Google Search Console.
                        <br />
                        Verify via the HTML tag.
                    </p>
                </div>
            </div>
            <section className="actions-footer">
                <button type="button" onClick={logout}>
                    Log Out
                </button>
                <button
                    type="button"
                    className="framer-button-primary"
                    onClick={() => {
                        window.open(
                            `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(site.googleSite?.siteUrl ?? site.url)}`,
                            "_blank"
                        )
                    }}
                >
                    Dashboard
                </button>
            </section>
        </div>
    )
}
