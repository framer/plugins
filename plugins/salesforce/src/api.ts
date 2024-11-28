import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import auth from "./auth"
import { BACKEND_URL } from "./constants"
import { PluginError } from "./PluginError"

/**
 * Salesforce Core
 */
export interface SFQueryResult<T> {
    size: number
    totalSize: number
    done: boolean
    records: T[]
    nextRecordsUrl?: string
}

type SFApiErrorResponse = Array<{
    message: string
    errorCode: string
}>

export interface SFSite {
    Id: string
    Name: string
}

export interface SFUser {
    sub: string
    name: string
    email: string
    organization_id: string
    user_id: string
    urls: {
        custom_domain: string
        // Add more as needed
    }
    // Add more as needed
}

export interface SFOrg {
    Id: string
    Name: string
    LanguageLocaleKey: string // e.g. "en_US"
    OrganizationType: string // e.g. "Developer Edition"
    // Add more as needed
}

export type SFTrustedSitesList = SFQueryResult<{
    Id: string
    EndpointUrl: string
}>

export type SFCorsWhitelist = SFQueryResult<{
    Id: string
    UrlPattern: string
}>

export interface EmbeddedService {
    Id: string
    DurableId: string
    Site: string
}

export interface SFObject {
    custom: boolean
    label: string
    labelPlural: string
    name: string
    keyPrefix: string
    // Add more fields as needed
}

export interface SFObjectConfig {
    fields: SFFieldConfig[]
}

export interface SFObjects {
    maxBatchSize: number
    sobjects: SFObject[]
}

export interface SFFieldConfig {
    name: string
    label: string
    updateable: boolean
    createable: boolean
    picklistValues?: Array<{
        value: string
        label: string
    }>
    referenceTo: string[] // e.g. ["User"]
    relationshipName: string // e.g. "Owner"
    type:
        | "id"
        | "boolean"
        | "currency"
        | "date"
        | "datetime"
        | "double"
        | "email"
        | "int"
        | "long"
        | "phone"
        | "multipicklist"
        | "picklist"
        | "reference"
        | "string"
        | "textarea"
        | "url"
        | "richtext"
        | "base64"
        | "time"
}

export type SFRecordFieldValue = string | number | null

export type SFRecord = Record<string, SFRecordFieldValue>

/**
 * Account Engagement
 */
export interface AEQueryResult<T> {
    nextPageToken: string | null
    nextPageUrl: string | null
    values: T[]
}

export interface AEErrorResponse {
    code: number
    message: string
}

export interface AEForm {
    id: string
    name: string
    url: string
    embedCode: string
    // Add more as needed
}

/**
 * Framer Salesforce Plugin Backend API
 */
export interface NewForm {
    webhook: string
}

export interface FramerSalesforceAPIErrorResponse {
    error: {
        message: string
    }
    details?: Array<{
        code: number
        message: string
    }>
}

type QueryParams = Record<string, string | number | string[]> | URLSearchParams

interface RequestOptions {
    path: string
    method?: string
    query?: QueryParams
    service?: "core" | "mcae" | null
    // eslint-disable-next-line
    body?: any
}

const SF_CORE_API_VERSION = "v62.0"
const ACCOUNT_ENGAGEMENT_API_VERSION = "v5"
const PROXY_URL = "https://framer-cors-proxy.framer-team.workers.dev/?"

// eslint-disable-next-line
const isSFApiErrorResponse = (data: any): data is SFApiErrorResponse => {
    return data && typeof data.errorCode === "string" && typeof data.message === "string"
}

// eslint-disable-next-line
const isAEErrorResponse = (data: any): data is AEErrorResponse => {
    return data && typeof data.code === "number" && typeof data.message === "string"
}

export const request = async <T = unknown>(
    { path, method, query, body, service = "core" }: RequestOptions,
    retries = 1
): Promise<T> => {
    try {
        const { instanceUrl, accessToken } = auth.tokens.getOrThrow()
        let businessUnitId: string | null
        let baseUrl: string

        const bodyAsJsonString = !body || Object.entries(body).length === 0 ? undefined : JSON.stringify(body)
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            "X-Prettyprint": "1",
        }

        if (bodyAsJsonString !== undefined) {
            headers["content-type"] = "application/json"
        }

        switch (service) {
            case "core": {
                baseUrl = `${instanceUrl}/services/data/${SF_CORE_API_VERSION}${path}`
                break
            }
            case "mcae": {
                const isDevOrg = instanceUrl.includes("dev-ed")
                const domain = isDevOrg ? "pi.demo.pardot.com" : "pi.pardot.com"
                baseUrl = `https://${domain}/api/${ACCOUNT_ENGAGEMENT_API_VERSION}${path}`

                businessUnitId = auth.getBusinessUnitId()
                if (!businessUnitId) {
                    throw new PluginError(
                        "Access Denied",
                        "You have not set your Business Unit ID. Please re-authenticate and add it."
                    )
                }

                headers["Pardot-Business-Unit-Id"] = businessUnitId

                break
            }
            default: {
                baseUrl = `${instanceUrl}${path}`
            }
        }

        const url = new URL(baseUrl)
        if (query) {
            Object.entries(query).forEach(([key, value]) => {
                if (value !== undefined) {
                    url.searchParams.append(key, value.toString())
                }
            })
        }

        const proxyUrl = `${PROXY_URL}${url.toString()}`

        const res = await fetch(proxyUrl, {
            method: method?.toUpperCase() ?? "GET",
            body: bodyAsJsonString,
            headers,
        })

        if (res.status === 204) return null as T

        const data: SFApiErrorResponse | AEErrorResponse | T = await res.json()

        if (res.ok) return data as T

        if (res.status === 403) {
            throw new PluginError(
                "Access Denied",
                "You either have insufficient permissions or your Org does not have access to this Salesforce feature"
            )
        }

        if (res.status === 401 && retries > 0) {
            try {
                // Refresh token and retry once
                await auth.refreshTokens()
                return request<T>({ path, method, query, body }, retries - 1)
            } catch {
                throw new PluginError("Auth Error", "Failed to refresh tokens")
            }
        }

        if (isSFApiErrorResponse(data)) {
            throw new PluginError("Salesforce API Error", data[0].message)
        }

        if (isAEErrorResponse(data)) {
            throw new PluginError("Account Engagement API Error", data.message)
        }

        throw new PluginError("Something went wrong", JSON.stringify(data))
    } catch (e) {
        if (e instanceof PluginError) throw e

        throw new PluginError("Something went wrong", e instanceof Error ? e.message : JSON.stringify(e))
    }
}

/**
 * Retrieve an object's configuration (fields, relations, etc...)
 */
export const fetchObjectConfig = (objectName: string) => {
    return request<SFObjectConfig>({
        path: `/sobjects/${objectName}/describe`,
    })
}

/**
 * Retrieve ALL of an object's records
 */
export const fetchObjectRecords = async (
    objectName: string,
    fields: string[],
    maxRecords?: number
): Promise<SFRecord[]> => {
    const allRecords: SFRecord[] = []
    let nextUrl: string | null = `/query/?q=SELECT+${fields.join(",")}+FROM+${objectName}`

    while (nextUrl && (!maxRecords || allRecords.length < maxRecords)) {
        const result: SFQueryResult<SFRecord> = await request({
            path: nextUrl,
        })

        const remainingRecords = maxRecords ? maxRecords - allRecords.length : result.records.length

        allRecords.push(...result.records.slice(0, remainingRecords))

        nextUrl = result.done || (maxRecords && allRecords.length >= maxRecords) ? null : result.nextRecordsUrl || null
    }

    return allRecords
}

/**
 * Retrieve information about the the Salesforce user
 */
export const useUserQuery = () => {
    return useQuery({
        queryKey: ["user"],
        queryFn: () => {
            return request<SFUser>({
                path: "/services/oauth2/userinfo",
                service: null,
            })
        },
    })
}

/**
 * Retrieve information about the Org
 */
export const useOrgQuery = (orgId: string) => {
    return useQuery({
        queryKey: ["org"],
        enabled: !!orgId,
        queryFn: () => {
            return request<SFOrg>({
                path: `/sobjects/Organization/${orgId}`,
            })
        },
    })
}

/**
 * Retrieve all of the Org's trusted domains
 */
export const useTrustedSitesQuery = () => {
    return useQuery({
        queryKey: ["trustedSites"],
        queryFn: () => {
            return request<SFTrustedSitesList>({
                path: `/tooling/query`,
                query: {
                    q: "SELECT Id,EndpointUrl FROM CspTrustedSite",
                },
            })
        },
    })
}

/**
 * Add a new trusted site to the Org - allowing Salesforce components
 * to be embedded onto external sites.
 */
export const useTrustedSiteMutation = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ url, description }: { url: string; description: string }) => {
            return request({
                method: "post",
                path: `/tooling/sobjects/CspTrustedSite`,
                body: {
                    EndpointUrl: url,
                    Description: description,
                    Context: "All",
                    DeveloperName: url
                        .replace(/^https?:\/\//, "")
                        .replace(/[^a-zA-Z0-9]+/g, "_")
                        .replace(/^-+|-+$/g, "")
                        .toLowerCase(),
                },
            })
        },
        onSuccess: () => queryClient.refetchQueries({ queryKey: ["trustedSites"] }),
    })
}

/**
 * Retrieve all the domains from the Org's CORS whitelist
 */
export const useCorsWhitelistQuery = () => {
    return useQuery({
        queryKey: ["corsWhitelist"],
        queryFn: () => {
            return request<SFCorsWhitelist>({
                path: "/query",
                query: {
                    q: "SELECT Id, UrlPattern FROM CorsWhitelistEntry",
                },
            })
        },
    })
}

/**
 * Add a new domain to the Org's CORS whitelist
 */
export const useCorsWhitelistMutation = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (urlPattern: string) => {
            return request({
                method: "post",
                path: "/sobjects/CorsWhitelistEntry",
                body: {
                    UrlPattern: urlPattern,
                },
            })
        },
        onSuccess: () => queryClient.refetchQueries({ queryKey: ["corsWhitelist"] }),
    })
}

/**
 * Remove a CORS whitelist entry from the Org
 */
export const useRemoveCorsWhitelistMutation = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => {
            return request({
                method: "delete",
                path: `/sobjects/CorsWhitelistEntry/${id}`,
            })
        },
        onSuccess: () => queryClient.refetchQueries({ queryKey: ["corsWhitelist"] }),
    })
}

/**
 * Remove a trusted site entry from the Org
 */
export const useRemoveTrustedSiteMutation = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => {
            return request({
                method: "delete",
                path: `/tooling/sobjects/CspTrustedSite/${id}`,
            })
        },
        onSuccess: () => queryClient.refetchQueries({ queryKey: ["trustedSites"] }),
    })
}

/**
 * Retrieve information about all of the Org's objects
 */
export const useObjectsQuery = () => {
    return useQuery({
        queryKey: ["objects"],
        queryFn: () => {
            return request<SFObjects>({
                path: "/sobjects",
            })
        },
    })
}

/**
 * Retrieve all messaging for web embedded services
 */
export const useMessagingEmbeddedServices = () => {
    return useQuery({
        queryKey: ["embedded-services"],
        queryFn: () => {
            // IsFieldServiceEnabled=True indicates 'Appointment Embed' - we ignore that as we
            // only want 'Messaging for In-App and Web' embeds
            return request<SFQueryResult<EmbeddedService>>({
                path: "/query",
                query: {
                    q: "SELECT Id,DurableId,Site FROM EmbeddedServiceDetail WHERE Site != null AND IsFieldServiceEnabled = False",
                },
            })
        },
        select: data => data.records,
    })
}

/**
 * Retrieve details about an Org's connected domain - connected means the domain
 * is referenced in some way, whether it be listed in the Org's allow list, in a
 * bot, etc...
 */
export const useSiteQuery = (siteId: string) => {
    return useQuery({
        queryKey: ["site", siteId],
        enabled: !!siteId,
        queryFn: () => {
            return request<SFSite>({
                path: `/sobjects/Site/${siteId}`,
            })
        },
    })
}

/**
 * Retrieve an object's configuration (fields, relations, etc...)
 */
export const useObjectConfigQuery = (objectName: string) => {
    return useQuery({
        queryKey: ["object-config", objectName],
        enabled: !!objectName,
        queryFn: () => fetchObjectConfig(objectName),
    })
}

/**
 * Retrieve ALL of an object's records
 */
export const useObjectRecordsQuery = (objectName: string, fields: string[]) => {
    return useQuery({
        queryKey: ["object-records", objectName, ...fields],
        enabled: !!objectName,
        queryFn: () => fetchObjectRecords(objectName, fields),
    })
}

/**
 * Retrieve all Account Engagement form handlers
 */
export const useAccountEngagementFormHandlers = () => {
    return useQuery({
        queryKey: ["ae-form-handlers"],
        queryFn: () => {
            return request<AEQueryResult<AEForm>>({
                service: "mcae",
                path: "/objects/form-handlers",
                query: {
                    fields: "id,name,url,embedCode",
                },
            })
        },
        select: data => data.values,
    })
}

/**
 * Retrieve all Account Engagement forms
 */
export const useAccountEngagementForms = () => {
    return useQuery({
        queryKey: ["ae-forms"],
        queryFn: () => {
            return request<AEQueryResult<AEForm>>({
                service: "mcae",
                path: "/objects/forms",
                query: {
                    fields: "id,name,url,embedCode",
                },
            })
        },
        select: data => data.values,
    })
}

/**
 * Retrieve or generate a webhook endpoint to create/update a new
 * Salesforce object
 */
export const useWebFormWebhookQuery = (objectName: string) => {
    return useQuery<NewForm>({
        queryKey: ["web-form-webhook", objectName],
        enabled: !!objectName,
        queryFn: async () => {
            const tokens = auth.tokens.getOrThrow()
            const res = await fetch(`${BACKEND_URL}/api/forms/web/create`, {
                method: "POST",
                body: JSON.stringify({ objectName }),
                headers: {
                    Authorization: `Bearer ${tokens.accessToken}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
            })

            if (!res.ok) {
                const data: FramerSalesforceAPIErrorResponse = await res.json()
                throw new PluginError("Webhook Creation Failed", data.error.message)
            }

            return res.json()
        },
    })
}

export const useLogoutMutation = ({ onSuccess, onError }: { onSuccess?: () => void; onError?: (e: Error) => void }) => {
    return useMutation({
        mutationFn: () => auth.logout(),
        onSuccess,
        onError,
    })
}
