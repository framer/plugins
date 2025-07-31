import { useCallback, useContext, useEffect, useState } from "react"
import { AccessTokenContext, useGoogleToken } from "../auth"
import Loading from "../components/Loading"
import { GoogleError } from "../errors"
import type { GoogleSitemap, SiteWithGoogleSite } from "../types"
import { googleApiCall, sitemapUrl } from "../utils"
import NeedsVerify from "./NeedsVerify"
import SiteHasIndexedSitemap from "./SiteHasIndexedSitemap"
import SiteHasUnindexedSitemap from "./SiteHasUnindexedSitemap"

interface SiteViewProps {
    site: SiteWithGoogleSite
    logout: () => void
}

// Change this to true to show mock sitemap data for testing.
const SHOW_MOCK_SITEMAP_DATA = !!import.meta.env.VITE_MOCK_DATA

export default function SiteView({ site, logout }: SiteViewProps) {
    const [sitemapsState, setSitemapsState] = useState<{
        sitemaps: GoogleSitemap[] | null
        submitted: boolean
    } | null>(null)
    const currSitemapUrl = sitemapUrl(site.url)
    const [error, setError] = useState<{
        level: "throw" | "display"
        e: Error
    } | null>(null)

    const accessToken = useContext(AccessTokenContext)

    const { refresh } = useGoogleToken()

    const fetchGoogleSitemaps = useCallback(
        async (siteUrl: string, token: string) => {
            const result = (await googleApiCall(
                `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
                token,
                refresh
            )) as { sitemap: GoogleSitemap[] } | null

            return result?.sitemap ?? []
        },
        [refresh]
    )

    const update = useCallback(() => {
        setError(null)

        if (SHOW_MOCK_SITEMAP_DATA) {
            return
        }

        const task = async () => {
            try {
                const sitemaps = await fetchGoogleSitemaps(site.googleSite.siteUrl, accessToken)
                const submittedSitemap = sitemaps.find(currSitemap => currSitemap.path === currSitemapUrl)

                setSitemapsState({ sitemaps, submitted: !!submittedSitemap })
            } catch (e) {
                if (((e as GoogleError | undefined)?.cause as { status: number } | undefined)?.status === 403) {
                    setError({ level: "display", e: e as GoogleError })
                } else {
                    setError({ level: "throw", e: e as GoogleError })
                }
            }
        }

        void task()
    }, [accessToken, currSitemapUrl, fetchGoogleSitemaps, site.googleSite])

    useEffect(() => {
        update()
    }, [update])

    if (error) {
        if (error.level === "throw") {
            throw error.e
        } else {
            return <NeedsVerify site={site} logout={logout} retry={update} />
        }
    }

    if (!sitemapsState && !SHOW_MOCK_SITEMAP_DATA) {
        return <Loading />
    }

    return sitemapsState?.submitted || SHOW_MOCK_SITEMAP_DATA ? (
        <SiteHasIndexedSitemap site={site} logout={logout} />
    ) : (
        <SiteHasUnindexedSitemap site={site} sitemapUrl={currSitemapUrl} />
    )
}
