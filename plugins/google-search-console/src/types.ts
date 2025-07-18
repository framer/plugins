import * as v from "valibot"

export const GoogleTokenSchema = v.object({
    access_token: v.string(),
    expires_in: v.number(),
    id_token: v.string(),
    scope: v.string(),
    token_type: v.string(),
    refresh_token: v.exactOptional(v.string()),
})

export type GoogleToken = v.InferOutput<typeof GoogleTokenSchema>

export const AuthorizeSchema = v.object({
    url: v.string(),
    readKey: v.string(),
})

export const GoogleSiteSchema = v.object({
    siteUrl: v.string(),
    permissionLevel: v.string(),
})

export type GoogleSite = v.InferOutput<typeof GoogleSiteSchema>

export interface Site {
    url: string
    domain: string
    custom: boolean
    googleSite: GoogleSite | null
    currentPageUrl?: string
}

export interface SiteWithGoogleSite extends Site {
    googleSite: GoogleSite
}

export interface GoogleSitemapContent {
    type: string
    submitted: string
    indexed: string
}

export interface GoogleSitemap {
    contents: GoogleSitemapContent[]
    path: string
    isPending: boolean
    isSitemapsIndex: boolean
    warnings: string
    errors: string
}

export interface GoogleInspectionResult {
    indexStatusResult: {
        verdict: "VERDICT_UNSPECIFIED" | "PASS" | "FAIL" | "NEUTRAL"
        coverageState?: string
    }
    inspectionResultLink: string
}

export interface GoogleQueryResult {
    responseAggregationType: "byProperty"
    rows?: {
        clicks: number
        ctr: number
        impressions: number
        keys: string[]
        position: number
    }[]
}
