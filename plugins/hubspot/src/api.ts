import { BlogPost } from "@hubspot/api-client/lib/codegen/cms/blogs/blog_posts/models/BlogPost"
import { HubDbTableRowV3 } from "@hubspot/api-client/lib/codegen/cms/hubdb/models/HubDbTableRowV3"
import { HubDbTableV3 } from "@hubspot/api-client/lib/codegen/cms/hubdb/models/HubDbTableV3"
import { useQuery } from "@tanstack/react-query"
import auth from "./auth"
import { queryClient } from "./main"
import { PluginError } from "./PluginError"

export interface CMSPaging<T> {
    total: number
    paging: {
        prev?: {
            link: string
            after: string
        }
        next?: {
            link: string
            after: string
        }
    }
    results: T[]
}

export interface HSQuery<T> {
    results: T[]
    total: number
}

export interface HubDBImage {
    url: string
    width: number
    height: number
    altText: string
    fileId: number
    type: "image"
}

export interface HubDBValueOption {
    id: string
    name: string
    label: string
    order: number
    type: "option"
}

export interface HubDBFile {
    id: number
    url: string
    type: "file"
}

export type HubDBCellValue = string | number | boolean | Date | HubDBImage | HubDBValueOption | HubDBFile

export interface HSAccount {
    portalId: number
    uiDomain: string
    dataHostingLocation: string
}

export interface HSUser {
    hub_id: number
    user: string
}

export interface HSInbox {
    id: string
    name: string
    createdAt: string
    archived: boolean
}

interface HSForm {
    id: string
    name: string
    // Add more as needed
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

interface RequestOptions {
    path: string
    method?: string
    query?: Record<string, string | number | string[]> | URLSearchParams
    body?: unknown
}

const PROXY_URL = "https://framer-cors-proxy.framer-team.workers.dev/?"
const API_URL = "https://api.hubapi.com"

const queryKeys = {
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

const request = async ({ path, method, query, body }: RequestOptions): Promise<unknown> => {
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
                        ? `${encodeURIComponent(key)}=${value.join(",")}` // Don't encode commas
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
            return {}
        }

        if (!res.ok) {
            throw new PluginError("Fetch Failed", `Failed to fetch HubSpot API: ${res.status}`)
        }

        return await res.json()
    } catch (e) {
        if (e instanceof PluginError) throw e

        throw new PluginError(
            "Something went wrong",
            e instanceof Error ? e.message : "That's all we know. " + JSON.stringify(e)
        )
    }
}

async function cachedFetch<T>(queryKey: readonly unknown[], fetcher: () => Promise<T>): Promise<T> {
    const cached = queryClient.getQueryData<T>(queryKey)
    if (cached) return cached

    const data = await fetcher()
    queryClient.setQueryData(queryKey, data)
    return data
}

export const fetchAllBlogPosts = (limit: number, properties: string[]): Promise<CMSPaging<BlogPost>> => {
    return cachedFetch(
        queryKeys.blogPosts(limit, properties),
        () => request({ path: "/cms/v3/blogs/posts", query: { limit, properties } }) as Promise<CMSPaging<BlogPost>>
    )
}

export const fetchPublishedTables = (limit: number): Promise<CMSPaging<HubDbTableV3>> => {
    return cachedFetch(
        queryKeys.publishedTables(limit),
        () => request({ path: "/cms/v3/hubdb/tables", query: { limit } }) as Promise<CMSPaging<HubDbTableV3>>
    )
}

export const fetchPublishedTable = (tableId: string): Promise<HubDbTableV3> => {
    return cachedFetch(
        queryKeys.publishedTable(tableId),
        () => request({ path: `/cms/v3/hubdb/tables/${tableId}` }) as Promise<HubDbTableV3>
    )
}

export const fetchTableRows = (
    tableId: string,
    properties: string[],
    limit: number
): Promise<CMSPaging<HubDbTableRowV3>> => {
    return cachedFetch(
        queryKeys.tableRows(tableId, properties, limit),
        () =>
            request({
                path: `/cms/v3/hubdb/tables/${tableId}/rows`,
                query: { limit, properties },
            }) as Promise<CMSPaging<HubDbTableRowV3>>
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
    return useQuery({
        queryKey: queryKeys.user(),
        queryFn: () => {
            const tokens = auth.tokens.getOrThrow()

            return request({
                method: "get",
                path: `/oauth/v1/access-tokens/${tokens.accessToken}`,
            }) as Promise<HSUser>
        },
    })
}

export const useAccountQuery = () => {
    return useQuery({
        queryKey: queryKeys.account(),
        queryFn: () => {
            return request({
                method: "get",
                path: "/account-info/v3/details",
            }) as Promise<HSAccount>
        },
    })
}

export const useInboxesQuery = () => {
    return useQuery({
        queryKey: queryKeys.inboxes(),
        queryFn: () => {
            return request({
                method: "GET",
                path: "/conversations/v3/conversations/inboxes/",
            }) as Promise<HSQuery<HSInbox>>
        },
        select: data => data.results,
    })
}

export const useFormsQuery = () => {
    return useQuery({
        queryKey: queryKeys.forms(),
        queryFn: () => {
            return request({
                method: "get",
                path: "/marketing/v3/forms/",
            }) as Promise<HSQuery<HSForm>>
        },
        select: data => data.results,
    })
}

export const useMeetingsQuery = () => {
    return useQuery({
        queryKey: queryKeys.meetings(),
        queryFn: () => {
            return request({
                method: "get",
                path: "/scheduler/v3/meetings/meeting-links",
            }) as Promise<HSQuery<HSMeeting>>
        },
        select: data => data.results,
    })
}
