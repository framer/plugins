import { useQuery } from "@tanstack/react-query"
import auth from "./auth"

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

const PROXY_URL = "https://framer-proxy.sakibulislam25800.workers.dev/?"
const API_URL = "https://api.hubapi.com"

interface RequestOptions {
    path: string
    method?: string
    query?: Record<string, string | number | string[]> | URLSearchParams
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any
}

const request = async <T = unknown>({ path, method, query, body }: RequestOptions): Promise<T> => {
    try {
        const tokens = auth.tokens.getOrThrow()

        const url = new URL(`${PROXY_URL}${API_URL}${path}`)

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

        const res = await fetch(url.toString(), {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const message = (e as any)?.body?.message ?? (e as any).message
        throw new Error(message ?? "Something went wrong. That's all we know.")
    }
}

export const useUserQuery = () => {
    return useQuery<HSUser>({
        queryKey: ["user"],
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
        queryKey: ["account"],
        queryFn: () =>
            request({
                method: "get",
                path: "/account-info/v3/details",
            }),
    })
}

export const useInboxesQuery = () => {
    return useQuery<HSInboxesResponse, Error, HSInbox[]>({
        queryKey: ["inboxes"],
        queryFn: () =>
            request({
                method: "GET",
                path: "/conversations/v3/conversations/inboxes/",
            }),
        select: data => data.results,
    })
}

export const useFormsQuery = () => {
    return useQuery<HSFormsResponse>({
        queryKey: ["forms"],
        queryFn: () =>
            request({
                method: "get",
                path: "/marketing/v3/forms/",
            }),
    })
}
