import world from "../images/World@2x.png"

interface NeedsPublishProps {
    login: () => void
}

export default function NeedsPublish({ login }: NeedsPublishProps) {
    return (
        <div className="interstitial">
            <div className="interstitial-content">
                <img className="img-plus" src={world} alt="" />
                <div>
                    <p className="interstitial-title">Publish your site</p>
                    <p>Your project has not been published yet. Please publish your site first, then try again.</p>
                </div>
            </div>
            <button type="button" onClick={login}>
                Retry
            </button>
        </div>
    )
}
