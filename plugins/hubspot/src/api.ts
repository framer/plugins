import { useQuery } from "@tanstack/react-query"
import auth from "./auth"
import { queryClient } from "./main"

export interface HSQueryResult<T> {
    total: number
    paging: {
        next: {
            link: string
            after: string
        }
    }
    results: T[]
}

export interface HSBlogPost {
    publishDate: string
    language: string
    metaDescription: string
    htmlTitle: string
    id: string
    state: string
    slug: string
    createdById: string
    currentlyPublished: boolean
    created: string
    updated: string
    authorName: string
    domain: string
    name: string
    url: string
    postSummary: string
    rssSummary: string
    postBody: string
    featuredImage: string
    featuredImageAltText: string
    useFeaturedImage: boolean
    linkRelCanonicalUrl: string
}

export type HubDBColumnType =
    | "TEXT"
    | "RICHTEXT"
    | "NUMBER"
    | "DATE"
    | "IMAGE"
    | "VIDEO"
    | "SELECT"
    | "MULTISELECT"
    | "URL"
    | "BOOLEAN"
    | "EMAIL"
    | "PHONE"
    | "LOCATION"
    | "USER"
    | "FILE"
    | "CURRENCY"

export interface HubDBValueOption {
    id: string
    name: string
    label: string
    type: "option"
    order: number
    createdAt: string
    updatedAt?: string
}

export interface HubDBFile {
    id: number
    url: string
    type: "file"
}

export interface HubDBImage {
    url: string
    width: number
    height: number
    altText: string
    fileId: number
    type: "image"
}

export interface HubDBVideo {
    url: string
    thumbnailUrl: string
    height: number
    width: number
    duration: number
    embedUrl: string
    fileId: number
    type: "video"
}

export interface HubDBForeignID {
    name: string
    id: string
    type: "FOREIGN_ID"
}

export interface HubDBColumn {
    id: string
    createdByUserId: number
    updatedByUserId?: number
    createdAt: string
    updatedAt?: string
    description: string
    label: string
    name: string
    type: HubDBColumnType
    optionCount: number
    options?: HubDBValueOption[] // For select/multiselect columns
    foreignTableId?: number // Reference to a foreign table
    foreignIds?: HubDBForeignID[] // Foreign keys for reference columns
    foreignIdsById?: Record<string, string> // Extra foreign key mappings
    foreignIdsByName?: Record<string, string>
}

export interface HubDBTable {
    id: string
    name: string
    label: string
    allowPublicApiAccess: boolean
    published: boolean
    publishedAt: string
    columnCount: number
    rowCount: number
    allowChildTables: boolean
    columns: HubDBColumn[]
}

export type HubDBCellValue = string | number | boolean | Date | HubDBImage | HubDBVideo | HubDBValueOption | HubDBFile

export interface HubDBRowValues {
    [columnName: string]: HubDBCellValue
}

export interface HubDBTableRow {
    id: string
    name: string
    path: string // Slug path for dynamic pages
    createdAt: string
    updatedAt: string
    childTableId?: string
    publishedAt: string
    values: HubDBRowValues
}

export interface HSAccount {
    portalId: number
    uiDomain: string
    dataHostingLocation: string
}

export interface HSUser {
    token: string
    user: string
    hub_domain: string
    scopes: string[]
    hub_id: number
    app_id: number
    expires_in: number
    user_id: number
    token_type: string
    signed_access_token: {
        expiresAt: number
        scopes: string
        hubId: number
        userId: number
        appId: number
        hublet: string
        // Add more as needed
    }
}

export interface HSInbox {
    id: string
    name: string
    createdAt: string
    archived: boolean
}

export interface HSInboxesResponse {
    results: HSInbox[]
    total: number
}

interface HSForm {
    id: string
    name: string
    // Add more as needed
}

interface HSFormsResponse {
    total: number
    results: HSForm[]
}

interface HSMeeting {
    id: string
    slug: string
    link: string
    name: string
    type: "PERSONAL_LINK" | "GROUP_CALENDAR" | "ROUND_ROBIN_CALENDAR"
    organizerUserId: string
    userIdsOfLinkMembers: string[]
    defaultLink: boolean
    createdAt: string
    updatedAt: string
}

interface HSMeetingsResponse {
    total: number
    results?: HSMeeting[]
}

interface RequestOptions {
    path: string
    method?: string
    query?: Record<string, string | number | string[]> | URLSearchParams
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any
}

const PROXY_URL = "https://framer-cors-proxy.framer-team.workers.dev/?"
const API_URL = "https://api.hubapi.com"

export const queryKeys = {
    blogPosts: (limit: number, properties: string[]) => ["blog-posts", limit, properties] as const,
    publishedTables: (limit: number) => ["hubdb-tables", limit] as const,
    publishedTable: (tableId: string) => ["hubdb-table", tableId] as const,
    tableRows: (tableId: string, properties: string[], limit: number) =>
        ["hubdb-table-rows", tableId, properties, limit] as const,
    user: () => ["user"] as const,
    account: () => ["account"] as const,
    inboxes: () => ["inboxes"] as const,
    forms: () => ["forms"] as const,
    meetings: () => ["meetings"] as const,
} as const

const request = async <T = unknown>({ path, method, query, body }: RequestOptions): Promise<T> => {
    try {
        let tokens = auth.tokens.getOrThrow()

        if (auth.isTokensExpired()) {
            tokens = await auth.refreshTokens()
        }

        let url = `${PROXY_URL}${API_URL}${path}`

        // Append query params
        if (query) {
            const queryString = Object.entries(query)
                .map(([key, value]) =>
                    Array.isArray(value)
                        ? `${encodeURIComponent(key)}=${value.join(",")}` // Join arrays with commas without encoding them
                        : `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
                )
                .join("&")

            url += `?${queryString}`
        }

        const res = await fetch(url, {
            method: method?.toUpperCase() ?? "GET",
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
            },
        })

        if (method === "delete" && res.status === 204) {
            return {} as T
        }

        if (!res.ok) {
            throw new Error("Failed to fetch HubSpot API: " + res.status)
        }

        const json = await res.json()

        return json
    } catch (e) {
        // eslint-disable-next-line
        const message = (e as any)?.body?.message ?? (e as any).message
        throw new Error(message ?? "Something went wrong. That's all we know.")
    }
}

async function cachedFetch<T>(queryKey: readonly unknown[], fetcher: () => Promise<T>): Promise<T> {
    const cached = queryClient.getQueryData<T>(queryKey)
    if (cached) return cached

    const data = await fetcher()
    queryClient.setQueryData(queryKey, data)
    return data
}

export const fetchAllBlogPosts = (limit: number, properties: string[]) => {
    return cachedFetch(queryKeys.blogPosts(limit, properties), () =>
        request<HSQueryResult<HSBlogPost>>({
            path: "/cms/v3/blogs/posts",
            query: { limit, properties },
        })
    )
}

export const fetchPublishedTables = (limit: number) => {
    return cachedFetch(queryKeys.publishedTables(limit), () =>
        request<HSQueryResult<HubDBTable>>({
            path: "/cms/v3/hubdb/tables",
            query: { limit },
        })
    )
}

export const fetchPublishedTable = (tableId: string) => {
    return cachedFetch(queryKeys.publishedTable(tableId), () =>
        request<HubDBTable>({
            path: `/cms/v3/hubdb/tables/${tableId}`,
        })
    )
}

export const fetchTableRows = (tableId: string, properties: string[], limit: number) => {
    return cachedFetch(queryKeys.tableRows(tableId, properties, limit), () =>
        request<HSQueryResult<HubDBTableRow>>({
            path: `/cms/v3/hubdb/tables/${tableId}/rows`,
            query: { limit, properties },
        })
    )
}

export const usePublishedTables = (limit: number) => {
    return useQuery({
        queryKey: queryKeys.publishedTables(limit),
        queryFn: () => fetchPublishedTables(limit),
        select: data => data.results,
    })
}

export const usePublishedTable = (tableId: string) => {
    return useQuery({
        queryKey: queryKeys.publishedTable(tableId),
        queryFn: () => fetchPublishedTable(tableId),
    })
}

export const useUserQuery = () => {
    return useQuery<HSUser>({
        queryKey: queryKeys.user(),
        queryFn: () => {
            const tokens = auth.tokens.getOrThrow()

            return request({
                method: "get",
                path: `/oauth/v1/access-tokens/${tokens.accessToken}`,
            })
        },
    })
}

export const useAccountQuery = () => {
    return useQuery<HSAccount>({
        queryKey: queryKeys.account(),
        queryFn: () => {
            return request({
                method: "get",
                path: "/account-info/v3/details",
            })
        },
    })
}

export const useInboxesQuery = () => {
    return useQuery<HSInboxesResponse, Error, HSInbox[]>({
        queryKey: queryKeys.inboxes(),
        queryFn: () => {
            return request({
                method: "GET",
                path: "/conversations/v3/conversations/inboxes/",
            })
        },
        select: data => data.results,
    })
}

export const useFormsQuery = () => {
    return useQuery<HSFormsResponse>({
        queryKey: queryKeys.forms(),
        queryFn: () => {
            return request({
                method: "get",
                path: "/marketing/v3/forms/",
            })
        },
    })
}

export const useMeetingsQuery = () => {
    return useQuery<HSMeetingsResponse>({
        queryKey: queryKeys.meetings(),
        queryFn: () => {
            return request({
                method: "get",
                path: "/scheduler/v3/meetings/meeting-links",
            })
        },
    })
}
