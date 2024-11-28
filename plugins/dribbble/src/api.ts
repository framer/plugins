import auth from "./auth"
import pLimit from "p-limit"

type RequestQueryParams = Record<string, string | number | string[]>

interface RequestOptions {
    path: string
    method?: string
    query?: RequestQueryParams
    // eslint-disable-next-line
    body?: any
}

interface PaginationParams extends Record<string, number> {
    page: number
    per_page: number
}

export interface Shot {
    id: number
    title: string
    description: string
    width: number
    height: number
    images: {
        hidpi: string | null
        normal: string
        teaser: string
    }
    low_profile: boolean
    published_at: string
    updated_at: string
    html_url: string
    animated: boolean
    tags: string[]
    attachments: Array<{
        id: number
        url: string
        thumbnail_url: string
        size: number
        content_type: string
        created_at: string
    }>
    projects: Array<{
        id: number
        name: string
        description: string
        shots_count: number
        created_at: string
        updated_at: string
    }>
    team?: {
        id: number
        name: string
        login: string
        html_url: string
        avatar_url: string
        bio: string
        location: string
        links: {
            web: string
            twitter: string
        }
        type: string
        created_at: string
        updated_at: string
    }
    video?: {
        id: number
        duration: number
        width: number
        height: number
        url: string
        small_preview_url: string
        large_preview_url: string
        xlarge_preview_url: string
    }
}

const DRIBBLE_BASE_URL = "https://api.dribbble.com/v2"
const MAX_PAGE_SIZE = 100 // v2 pagination limit
const CONCURRENCY_LIMIT = 10 // v2 limit: 60 requests per minute

const request = async <T = unknown>({
    path,
    method,
    query,
    body,
}: RequestOptions): Promise<{ data: T; headers: Headers }> => {
    const tokens = auth.tokens.getOrThrow()
    const url = new URL(`${DRIBBLE_BASE_URL}${path}`)

    if (query) {
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined) {
                if (Array.isArray(value)) {
                    value.forEach(val => url.searchParams.append(key, decodeURIComponent(val)))
                } else {
                    url.searchParams.append(key, String(value))
                }
            }
        }
    }

    const res = await fetch(url, {
        method: method?.toUpperCase() ?? "GET",
        body: body ? JSON.stringify(body) : undefined,
        headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
        },
    })

    if (method === "delete" && res.status === 204) {
        return { data: {} as T, headers: res.headers }
    }

    if (!res.ok) {
        throw new Error(`Failed to fetch Dribbble API: ${res.status}`)
    }

    const data = await res.json()
    return { data: data as T, headers: res.headers }
}

const parseLinkHeader = (headers: Headers): { next?: string } => {
    const linkHeader = headers.get("Link")
    if (!linkHeader) return {}

    const links = linkHeader.split(",").reduce(
        (acc, part) => {
            const match = part.match(/<(.+)>;\s*rel="(\w+)"/)
            if (match) {
                const [, url, rel] = match
                return { ...acc, [rel]: url }
            }
            return acc
        },
        {} as Record<string, string>
    )

    return { next: links["next"] }
}

const paginatedRequest = async <T = unknown>(options: RequestOptions): Promise<{ data: T; nextUrl?: string }> => {
    const { data, headers } = await request<T>(options)
    const { next } = parseLinkHeader(headers)

    return {
        data,
        nextUrl: next,
    }
}

export const fetchShots = async (params: PaginationParams): Promise<{ shots: Shot[]; nextUrl?: string }> => {
    const response = await paginatedRequest<Shot[]>({
        path: "/user/shots",
        query: params,
    })

    return {
        shots: response.data,
        nextUrl: response.nextUrl,
    }
}

export const fetchAllShots = async (max: number): Promise<Shot[]> => {
    const limit = pLimit(CONCURRENCY_LIMIT)
    let allShots: Shot[] = []

    // Get initial page
    const { shots: firstPage, nextUrl } = await fetchShots({
        page: 1,
        per_page: MAX_PAGE_SIZE,
    })

    allShots = [...firstPage]

    const urlsToFetch: string[] = []
    let currentNextUrl = nextUrl

    // Collect all URLs to fetch
    while (currentNextUrl && allShots.length + urlsToFetch.length * MAX_PAGE_SIZE < max) {
        urlsToFetch.push(currentNextUrl)
        const { nextUrl } = await fetchShots({
            page: Number(new URL(currentNextUrl).searchParams.get("page")),
            per_page: MAX_PAGE_SIZE,
        })
        currentNextUrl = nextUrl
    }

    const results = await Promise.all(
        urlsToFetch.map(url =>
            limit(() =>
                fetchShots({
                    page: Number(new URL(url).searchParams.get("page")),
                    per_page: MAX_PAGE_SIZE,
                })
            )
        )
    )

    allShots = allShots.concat(...results.map(r => r.shots))

    if (allShots.length > max) {
        allShots = allShots.slice(0, max)
    }

    return allShots
}
