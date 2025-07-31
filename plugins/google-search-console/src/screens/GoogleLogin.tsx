import bigSearch from "../images/BigSearch@2x.png"

interface GoogleLoginProps {
    login: () => void
    loading: boolean
    hasError?: boolean
    errorMessage?: string
}

export default function GoogleLogin({ login, loading, hasError, errorMessage }: GoogleLoginProps) {
    return (
        <div className="interstitial">
            <div className="interstitial-content interstitial-content--start">
                <img className="big-g" src={bigSearch} alt="" />
                <div>
                    <p className="interstitial-title">Connect to Google</p>
                    <p>
                        {hasError
                            ? (errorMessage ??
                              "Sorry, there was an error connecting to your Google account. Please try again.")
                            : "Improve your performance on Google Search. Make sure your site is published first, then log in."}
                    </p>
                </div>
            </div>
            <button type="button" onClick={login} disabled={loading}>
                {loading ? "Loading..." : "Log In"}
            </button>
        </div>
    )
}
