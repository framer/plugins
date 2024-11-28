import { useQuery } from "@tanstack/react-query"
import { queryClient } from "./main"
import auth from "./auth"
import { PluginError } from "./PluginError"

import type { Column, ColumnTypeEnum } from "@hubspot/api-client/lib/codegen/cms/hubdb/models/Column"
import type { BlogPost } from "@hubspot/api-client/lib/codegen/cms/blogs/blog_posts/models/BlogPost"
import type { HubDbTableV3 } from "@hubspot/api-client/lib/codegen/cms/hubdb/models/HubDbTableV3"
import type { HubDbTableRowV3 } from "@hubspot/api-client/lib/codegen/cms/hubdb/models/HubDbTableRowV3"

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

export type HubDBForeignValues = Array<{
    id: string
    name: string
    type: "foreignid"
}>

export type HubDBCellValue =
    | string
    | number
    | boolean
    | Date
    | HubDBImage
    | HubDBValueOption
    | HubDBFile
    | HubDBForeignValues

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any
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
            return {} as T
        }

        if (!res.ok) {
            throw new PluginError("Fetch Failed", "Failed to fetch HubSpot API: " + res.status)
        }

        const json = await res.json()

        return json
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

export const fetchAllBlogPosts = (limit: number, properties: string[]) => {
    return cachedFetch(queryKeys.blogPosts(limit, properties), () =>
        request<CMSPaging<BlogPost>>({
            path: "/cms/v3/blogs/posts",
            query: { limit, properties },
        })
    )
}

export const fetchPublishedTables = (limit: number) => {
    return cachedFetch(queryKeys.publishedTables(limit), () =>
        request<CMSPaging<HubDbTableV3>>({
            path: "/cms/v3/hubdb/tables",
            query: { limit },
        })
    )
}

export const fetchPublishedTable = (tableId: string) => {
    return cachedFetch(queryKeys.publishedTable(tableId), () =>
        request<HubDbTableV3>({
            path: `/cms/v3/hubdb/tables/${tableId}`,
        })
    )
}

export const fetchTableRows = (tableId: string, properties: string[], limit: number) => {
    return cachedFetch(queryKeys.tableRows(tableId, properties, limit), () =>
        request<CMSPaging<HubDbTableRowV3>>({
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
    return useQuery({
        queryKey: queryKeys.user(),
        queryFn: () => {
            const tokens = auth.tokens.getOrThrow()

            return request<HSUser>({
                method: "get",
                path: `/oauth/v1/access-tokens/${tokens.accessToken}`,
            })
        },
    })
}

export const useAccountQuery = () => {
    return useQuery({
        queryKey: queryKeys.account(),
        queryFn: () => {
            return request<HSAccount>({
                method: "get",
                path: "/account-info/v3/details",
            })
        },
    })
}

export const useInboxesQuery = () => {
    return useQuery({
        queryKey: queryKeys.inboxes(),
        queryFn: () => {
            return request<HSQuery<HSInbox>>({
                method: "GET",
                path: "/conversations/v3/conversations/inboxes/",
            })
        },
        select: data => data.results,
    })
}

export const useFormsQuery = () => {
    return useQuery({
        queryKey: queryKeys.forms(),
        queryFn: () => {
            return request<HSQuery<HSForm>>({
                method: "get",
                path: "/marketing/v3/forms/",
            })
        },
        select: data => data.results,
    })
}

export const useMeetingsQuery = () => {
    return useQuery({
        queryKey: queryKeys.meetings(),
        queryFn: () => {
            return request<HSQuery<HSMeeting>>({
                method: "get",
                path: "/scheduler/v3/meetings/meeting-links",
            })
        },
        select: data => data.results,
    })
}

export { BlogPost, Column, ColumnTypeEnum, HubDbTableRowV3 }
