import * as cheerio from "cheerio"
import { useContext, useEffect, useState } from "react"
import { useErrorBoundary } from "react-error-boundary"
import InlineSpinner from "../components/InlineSpinner"
import Loading from "../components/Loading"
import { useBatchIndexingResult, useMockPerformanceResults, usePerformanceResults } from "../hooks"
import doc from "../images/Doc.svg"
import indexAdded from "../images/IndexAdded.svg"
import indexNone from "../images/IndexNone.svg"
import { mockUrls } from "../mocks"
import { ResizeContext } from "../resize"
import type { GoogleInspectionResult, SiteWithGoogleSite } from "../types"
import { getDateRange } from "../utils"
import Performance from "./Performance"

interface URLRowProps {
    url: string
    inspection?: GoogleInspectionResult | null
}

// Change this to true to show mock sitemap data for testing.
const SHOW_MOCK_SITEMAP_DATA = !!import.meta.env.VITE_MOCK_DATA

function useMockBatchIndexingResult() {
    const result: Record<string, GoogleInspectionResult> = {}

    for (const url of mockUrls) {
        result[url] = {
            indexStatusResult: {
                verdict: url === "https://benframer.lionfeet.com/" ? "PASS" : "NEUTRAL",
            },
            inspectionResultLink: "#",
        }
    }

    return result
}

function URLRow({ url, inspection }: URLRowProps) {
    const urlObject = new URL(url)
    const formattedUrl = url.slice(url.indexOf(urlObject.hostname) + urlObject.hostname.length)
    const friendlyUrl = formattedUrl === "/" ? "Home" : formattedUrl

    const row = (
        <div className="url-inner">
            <div className="url-title-row">
                <img src={doc} alt="" width="12" height="12" />
                <div className="url-path">{friendlyUrl}</div>
                <div className="url-status-icon">
                    {inspection ? (
                        <img
                            src={inspection.indexStatusResult.verdict === "PASS" ? indexAdded : indexNone}
                            alt={inspection.indexStatusResult.verdict === "PASS" ? "Indexed" : "Not indexed"}
                            width={16}
                            height={16}
                        />
                    ) : (
                        <InlineSpinner />
                    )}
                </div>
                <div className="url-inspect">Inspect</div>
            </div>
        </div>
    )

    return (
        <div className="url">
            {inspection?.inspectionResultLink ? (
                <a href={inspection.inspectionResultLink} target="_blank" rel="noopener">
                    {row}
                </a>
            ) : (
                row
            )}
        </div>
    )
}

interface SiteHasIndexedSitemapProps {
    site: SiteWithGoogleSite
    logout: () => void
}

interface URLStatusesProps {
    urls: string[] | null
    googleSiteUrl: string
}

const useBatchIndexingResultHook = SHOW_MOCK_SITEMAP_DATA ? useMockBatchIndexingResult : useBatchIndexingResult

function URLStatuses({ urls, googleSiteUrl }: URLStatusesProps) {
    const batchResult = useBatchIndexingResultHook(urls, googleSiteUrl)

    return (
        <div className="groups">
            <div>
                <div className="pages-section-title">Indexing</div>
                <div className="urls-list">
                    {urls ? (
                        urls.map(result => <URLRow key={result} url={result} inspection={batchResult?.[result]} />)
                    ) : (
                        <Loading inline />
                    )}
                </div>
            </div>
        </div>
    )
}

const dates = getDateRange(14)

const usePerformanceResultsHook = SHOW_MOCK_SITEMAP_DATA ? useMockPerformanceResults : usePerformanceResults

export default function SiteHasIndexedSitemap({ site, logout }: SiteHasIndexedSitemapProps) {
    const { showBoundary } = useErrorBoundary()

    const [urls, setUrls] = useState<string[] | null>(null)

    useEffect(() => {
        async function update() {
            try {
                if (SHOW_MOCK_SITEMAP_DATA) {
                    setUrls([...new Set(mockUrls)].sort())
                    return
                }

                const sitemapResult = await fetch(`https://cors.farpace.workers.dev/${site.domain}/sitemap.xml`)
                const sitemapText = await sitemapResult.text()

                const sitemap = cheerio.load(sitemapText, { xmlMode: true })
                const urls = sitemap("loc")
                    .map((_, el) => sitemap(el).text())
                    .get()

                setUrls([...new Set(urls)].sort())
            } catch (e) {
                showBoundary(e)
            }
        }

        void update()
    }, [showBoundary, site.domain])

    const performance = usePerformanceResultsHook(site.googleSite.siteUrl, dates)

    const resize = useContext(ResizeContext)

    useEffect(() => {
        if (resize && performance) {
            resize("long")
        }
    }, [resize, performance])

    return (
        <div className="in-app">
            <Performance siteUrl={site.googleSite.siteUrl} performance={performance} />
            <section>
                <URLStatuses urls={urls} googleSiteUrl={site.googleSite.siteUrl} />
            </section>
            <section className="actions-footer">
                <button type="button" onClick={logout}>
                    Log Out
                </button>
                <button
                    type="button"
                    className="framer-button-primary"
                    onClick={() => {
                        window.open(
                            `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(site.googleSite.siteUrl || site.url)}`,
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
