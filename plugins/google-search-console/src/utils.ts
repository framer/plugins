import { getLocalStorageTokens } from "./auth"
import { GoogleError } from "./errors"
import type { GoogleQueryResult, GoogleToken } from "./types"

export function sitemapUrl(siteUrl: string) {
    const fullUrl = new URL(siteUrl)
    fullUrl.pathname = "/sitemap.xml"

    return fullUrl.toString()
}

export function stripTrailingSlash(str: string) {
    return str.endsWith("/") ? str.slice(0, str.length - 1) : str
}

interface BatchGoogleApiCallRequest {
    apiPath: string
    method: "GET" | "PUT" | "POST"
    body: object
}

function* chunks<T>(arr: T[], n: number): Generator<T[], void> {
    for (let i = 0; i < arr.length; i += n) {
        yield arr.slice(i, i + n)
    }
}

const batchLimit = 900

export async function batchGoogleApiCall<P extends BatchGoogleApiCallRequest>(
    token: string,
    refresh: () => Promise<GoogleToken | null>,
    parts: P[]
): Promise<({ request: P; response: unknown } | null)[] | null> {
    if (!parts.length) {
        return null
    }

    const initialToken = getLocalStorageTokens()

    const boundary = "batch_boundary"

    const processParts = async (currParts: P[]) => {
        const fetchBody = `
${currParts
    .map(
        (part, index) => `
--${boundary}
Content-Type: application/http
Content-ID: <request-${index}>

${part.method} ${part.apiPath} HTTP/1.1
Content-Type: application/json

${JSON.stringify(part.body)}

`
    )
    .join("")}

--${boundary}--
`

        const attempt = async (currToken: string) =>
            await fetch(`https://searchconsole.googleapis.com/batch`, {
                headers: {
                    Authorization: `Bearer ${currToken}`,
                    Accept: "application/json",
                    "Content-Type": `multipart/mixed; boundary=${boundary}`,
                },
                body: fetchBody,
                method: "POST",
            })

        let result = await attempt(initialToken?.access_token ?? token)

        if (!result.ok) {
            const newToken = await refresh()

            if (newToken) {
                result = await attempt(newToken.access_token)
            }
        }

        if (!result.ok) {
            throw new GoogleError("API call error")
        }

        try {
            const text = await result.text()

            const textParts = text.split("--batch_").map(part => {
                try {
                    const indexId = /<response-request-([0-9]+)>/.exec(part)?.[1]
                    if (!indexId) return null

                    const request = currParts[Number(indexId)]
                    if (!request) return null

                    const response = JSON.parse(part.slice(part.indexOf("{"))) as unknown

                    return { request, response }
                } catch (e) {
                    return null
                }
            })

            return textParts
        } catch (e) {
            return null
        }
    }

    const partChunks = [...chunks(parts, batchLimit)]

    const promises = await Promise.all(partChunks.map(partChunk => processParts(partChunk)))

    const flat = promises.flat()

    return flat
}

export async function googleApiCall(
    path: string,
    token: string,
    refresh: () => Promise<GoogleToken | null>,
    opts: {
        method?: "GET" | "PUT" | "POST"
        body?: BodyInit
    } = { method: "GET" }
): Promise<unknown> {
    const initialToken = getLocalStorageTokens()

    const attempt = async (currToken: string) =>
        await fetch(`https://searchconsole.googleapis.com${path}`, {
            headers: {
                Authorization: `Bearer ${currToken}`,
                Accept: "application/json",
            },
            ...(opts.method !== "GET" ? opts : {}),
        })

    let result = await attempt(initialToken?.access_token ?? token)

    if (!result.ok) {
        const newToken = await refresh()

        if (newToken) {
            result = await attempt(newToken.access_token)
        }
    }

    if (!result.ok) {
        const err = new GoogleError("API call error")
        err.cause = result
        throw err
    }

    try {
        const json = (await result.json()) as unknown

        return json
    } catch (e) {
        return null
    }
}

export function getDateRange(range: number) {
    const today = new Date()

    const dates = [today]
    for (let i = 1; i < range; i++) {
        dates.push(new Date(new Date(today).setDate(today.getDate() - i)))
    }

    return dates.map(date => date.toISOString().split("T", 1)[0]).filter(isDefined)
}

export function mapQueries(queries: GoogleQueryResult) {
    if (!queries.rows) {
        return []
    }

    const mapped = queries.rows.map(query => ({
        key: query.keys[0],
        val: query.clicks,
    }))

    const maxVal = Math.max(...mapped.map(item => item.val))

    return mapped.map(item => ({
        ...item,
        percent: item.val / maxVal || 0,
    }))
}

export function isDefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined
}
