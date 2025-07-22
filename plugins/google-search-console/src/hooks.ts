import { useContext, useEffect, useState } from "react"
import { useErrorBoundary } from "react-error-boundary"
import * as v from "valibot"
import { AccessTokenContext, useGoogleToken } from "./auth"
import type { GoogleInspectionResult, GoogleQueryResult } from "./types"
import { batchGoogleApiCall, googleApiCall, isDefined } from "./utils"

export function useBatchIndexingResult(urls: string[] | null, googleSiteUrl: string) {
    const accessToken = useContext(AccessTokenContext)
    const [result, setResult] = useState<Record<string, GoogleInspectionResult> | null>(null)

    const { refresh } = useGoogleToken()

    useEffect(() => {
        const task = async () => {
            const batchResponse = await batchGoogleApiCall(
                accessToken,
                refresh,
                (urls ?? []).map(url => ({
                    apiPath: "/v1/urlInspection/index:inspect",
                    method: "POST",
                    body: {
                        inspectionUrl: url,
                        siteUrl: googleSiteUrl,
                        languageCode: window.navigator.language,
                    },
                }))
            )

            if (!batchResponse) return

            const urlsWithStatus: Record<string, GoogleInspectionResult> = {}
            for (const responseUrl of batchResponse) {
                if (!responseUrl) continue
                const { inspectionResult } = responseUrl.response as { inspectionResult: GoogleInspectionResult }
                urlsWithStatus[responseUrl.request.body.inspectionUrl] = inspectionResult
            }

            setResult(urlsWithStatus)
        }

        void task()
    }, [accessToken, googleSiteUrl, refresh, urls])

    return result
}

export function useIndexingResults(urls: string[] | null, currentPageUrl: string | undefined, googleSiteUrl?: string) {
    const { showBoundary } = useErrorBoundary()

    const accessToken = useContext(AccessTokenContext)

    const [result, setResult] = useState<{
        progress: number
        results: { url: string; inspection: GoogleInspectionResult }[] | null
    }>({ progress: 0, results: null })

    const [currPageResult, setCurrPageResult] = useState<{
        url: string
        inspection: GoogleInspectionResult
    } | null>(null)

    const incrementProgress = () => {
        setResult(currResult => ({
            ...currResult,
            progress: currResult.progress + 1,
        }))
    }

    const { refresh } = useGoogleToken()

    useEffect(() => {
        if (!googleSiteUrl) {
            return
        }

        async function update() {
            setResult({ progress: 0, results: null })

            if (currentPageUrl) {
                const currPageTask = async () => {
                    const currInspection = (await googleApiCall(
                        "/v1/urlInspection/index:inspect",
                        accessToken,
                        refresh,
                        {
                            method: "POST",
                            body: JSON.stringify({
                                inspectionUrl: currentPageUrl,
                                siteUrl: googleSiteUrl,
                                languageCode: window.navigator.language,
                            }),
                        }
                    )) as { inspectionResult: GoogleInspectionResult } | null

                    setCurrPageResult(
                        currInspection && {
                            url: currentPageUrl,
                            inspection: currInspection.inspectionResult,
                        }
                    )
                }

                void currPageTask()
            }

            const promises = (urls ?? []).map(async url => {
                const inspection = (await googleApiCall("/v1/urlInspection/index:inspect", accessToken, refresh, {
                    method: "POST",
                    body: JSON.stringify({
                        inspectionUrl: url,
                        siteUrl: googleSiteUrl,
                        languageCode: window.navigator.language,
                    }),
                })) as { inspectionResult: GoogleInspectionResult } | null

                incrementProgress()

                return inspection && { url, inspection: inspection.inspectionResult }
            })

            try {
                const results = await Promise.all(promises)
                setResult(currResult => ({ progress: currResult.progress, results: results.filter(isDefined) }))
            } catch (e) {
                showBoundary(e)
            }
        }

        void update()
    }, [accessToken, currentPageUrl, googleSiteUrl, refresh, showBoundary, urls])

    return { currPageResult, result }
}

function randomIntFromInterval(min: number, max: number) {
    return Math.floor(min + Math.random() * (max - min + 1))
}

const RandomDataSchema = v.array(v.array(v.number()))
type RandomData = v.InferOutput<typeof RandomDataSchema>

export function useMockPerformanceResults(): {
    dailyPerformance: GoogleQueryResult
    queryPerformance: GoogleQueryResult
} {
    const getRandomData = (): RandomData => {
        const savedData = window.localStorage.getItem("searchConsoleRandomChartData")

        if (savedData) {
            return v.parse(RandomDataSchema, JSON.parse(savedData))
        }

        const randomDataGen = []
        for (let i = 0; i < 14; i++) {
            const clicks = randomIntFromInterval(1000, 3000)
            const impressions = clicks + randomIntFromInterval(1000, 3000)
            randomDataGen.push([clicks, impressions])
        }

        window.localStorage.setItem("searchConsoleRandomChartData", JSON.stringify(randomDataGen))

        return randomDataGen
    }

    const randomData = getRandomData()

    const dailyPerformance = randomData.map((row, index) => {
        const date = new Date()
        date.setDate(date.getDate() - index)

        return {
            keys: [date.toISOString()],
            clicks: row[0] ?? 0,
            impressions: row[1] ?? 0,
            ctr: 0,
            position: 0,
        }
    })

    return {
        dailyPerformance: {
            responseAggregationType: "byProperty",
            rows: dailyPerformance,
        },
        queryPerformance: {
            responseAggregationType: "byProperty",
        },
    }
}

export function usePerformanceResults(siteUrl: string, dates: string[]) {
    const [data, setData] = useState<{
        dailyPerformance: GoogleQueryResult
        queryPerformance: GoogleQueryResult
    } | null>(null)

    const { showBoundary } = useErrorBoundary()

    const accessToken = useContext(AccessTokenContext)

    const { refresh } = useGoogleToken()

    useEffect(() => {
        const update = async () => {
            try {
                const dailyPerformance = (await googleApiCall(
                    `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
                    accessToken,
                    refresh,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            startDate: dates[dates.length - 1],
                            endDate: dates[0],
                            dimensions: ["date"],
                        }),
                    }
                )) as GoogleQueryResult

                const queryPerformance = (await googleApiCall(
                    `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
                    accessToken,
                    refresh,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            startDate: dates[dates.length - 1],
                            endDate: dates[0],
                            dimensions: ["query"],
                            rowLimit: 5,
                        }),
                    }
                )) as GoogleQueryResult

                setData({ dailyPerformance, queryPerformance })
            } catch (e) {
                showBoundary(e)
            }
        }

        void update()
    }, [accessToken, dates, refresh, showBoundary, siteUrl])

    return data
}
