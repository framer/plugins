import { framer, type PublishInfo } from "framer-plugin"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { ErrorBoundary, useErrorBoundary } from "react-error-boundary"
import "./App.css"
import * as v from "valibot"
import { AccessTokenContext, useGoogleToken } from "./auth"
import Loading from "./components/Loading"
import { LARGE_HEIGHT, PLUGIN_WIDTH, SMALL_HEIGHT } from "./constants"
import { mockSiteInfo } from "./mocks"
import CriticalError from "./screens/CriticalError"
import GoogleLogin from "./screens/GoogleLogin"
import NeedsPublish from "./screens/NeedsPublish"
import SiteView from "./screens/SiteView"
import { type GoogleSite, GoogleSiteSchema, type Site } from "./types"
import { googleApiCall, stripTrailingSlash } from "./utils"

void framer.showUI({
    position: "top right",
    width: PLUGIN_WIDTH,
    height: SMALL_HEIGHT,
    minWidth: PLUGIN_WIDTH,
    minHeight: SMALL_HEIGHT,
})

// Change this to true to show mock sitemap data for testing.
const SHOW_MOCK_SITEMAP_DATA = !!import.meta.env.VITE_MOCK_DATA

function usePublishedSite() {
    const [publishInfo, setPublishInfo] = useState<PublishInfo | null>(null)
    const [siteInfo, setSiteInfo] = useState<Site>()
    const { showBoundary } = useErrorBoundary()

    const [needsPublish, setNeedsPublish] = useState(false)

    const accessToken = useContext(AccessTokenContext)

    useEffect(() => {
        return framer.subscribeToPublishInfo(setPublishInfo)
    }, [])

    const { refresh } = useGoogleToken()

    const fetchGoogleSites = useCallback(
        async (token: string): Promise<GoogleSite[]> => {
            const result = (await googleApiCall(`/webmasters/v3/sites`, token, refresh)) as {
                siteEntry: GoogleSite[]
            } | null

            return result?.siteEntry ?? []
        },
        [refresh]
    )

    useEffect(() => {
        async function update() {
            if (SHOW_MOCK_SITEMAP_DATA) {
                return
            }

            try {
                if (publishInfo) {
                    if (publishInfo.production?.url) {
                        const domain = new URL(publishInfo.production.url).hostname

                        const googleSites = await fetchGoogleSites(accessToken)

                        const url = stripTrailingSlash(publishInfo.production.url)

                        const googleSite =
                            googleSites.find(currSite => currSite.siteUrl === `sc-domain:${domain}`) ??
                            googleSites.find(currSite => stripTrailingSlash(currSite.siteUrl) === url) ??
                            null

                        setSiteInfo({
                            url,
                            domain,
                            custom: !domain.endsWith(".framer.app"),
                            googleSite,
                            currentPageUrl: publishInfo.production.currentPageUrl,
                        })
                    } else {
                        setNeedsPublish(true)
                    }
                }
            } catch (e) {
                showBoundary(e)
            }
        }

        void update()
    }, [accessToken, fetchGoogleSites, publishInfo, showBoundary])

    if (SHOW_MOCK_SITEMAP_DATA) {
        return mockSiteInfo
    }

    return { siteInfo, needsPublish }
}

interface AppLoadSiteProps {
    login: () => void
    logout: () => void
}

const WithGoogleSiteSchema = v.object({ googleSite: GoogleSiteSchema })

function AppLoadSite({ login, logout }: AppLoadSiteProps) {
    const site = usePublishedSite()

    if (site.needsPublish) {
        return <NeedsPublish login={login} />
    }

    return !site.siteInfo ? (
        <Loading />
    ) : v.is(WithGoogleSiteSchema, site.siteInfo) ? (
        <SiteView site={site.siteInfo} logout={logout} />
    ) : (
        <CriticalError site={site.siteInfo} logout={logout} />
    )
}

const ErrorSchema = v.object({ name: v.string(), message: v.string() })

export function App() {
    const { login, logout, tokens, isReady, loading } = useGoogleToken()

    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!tokens?.access_token) {
            void framer.showUI({ width: PLUGIN_WIDTH, height: SMALL_HEIGHT })
        } else {
            void framer.showUI({ width: PLUGIN_WIDTH, height: LARGE_HEIGHT })
        }
    }, [tokens?.access_token])

    return (
        <main key={tokens?.access_token ?? "logout"} ref={ref}>
            <ErrorBoundary
                FallbackComponent={({ error }: { error: unknown }) => {
                    const errorMessage = v.is(ErrorSchema, error) && error.name !== "GoogleError" ? error.message : ""
                    return <GoogleLogin loading={loading} hasError errorMessage={errorMessage} login={login} />
                }}
                resetKeys={[tokens?.access_token]}
            >
                {isReady ? (
                    tokens?.access_token ? (
                        <AccessTokenContext.Provider value={tokens.access_token}>
                            <AppLoadSite key={tokens.access_token} login={login} logout={logout} />
                        </AccessTokenContext.Provider>
                    ) : (
                        <GoogleLogin login={login} loading={loading} />
                    )
                ) : null}
            </ErrorBoundary>
        </main>
    )
}
