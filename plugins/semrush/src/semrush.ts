import * as v from "valibot"

const apiErrorSchema = v.looseObject({
    message: v.string(),
})

const userAgentTypeSchema = v.pipe(v.number(), v.toMinValue(2), v.toMaxValue(7))

const projectSchema = v.object({
    project_id: v.number(),
    project_name: v.string(),
    url: v.string(),
    domain_unicode: v.string(),
    tools: v.array(
        v.object({
            tool: v.string(),
        })
    ),
    owner_id: v.number(),
    permission: v.array(v.string()),
})

const auditEnabledSchema = v.looseObject({
    status: v.string(),
})

const keywordsTableSchema = v.array(
    v.object({
        Keyword: v.string(),
        Intent: v.string(),
        CPC: v.string(),
        Trends: v.string(),
        "Search Volume": v.string(),
        "Number of Results": v.string(),
        "Keyword Difficulty Index": v.string(),
    })
)

// eslint-disable-next-line
const auditSettingsSchema = v.object({
    domain: v.string(),
    scheduleDay: v.optional(v.pipe(v.number(), v.toMinValue(0), v.toMaxValue(7))),
    notify: v.optional(v.boolean()),
    allow: v.optional(v.array(v.string())),
    disallow: v.optional(v.array(v.string())),
    pageLimit: v.optional(v.pipe(v.number(), v.toMinValue(1), v.toMaxValue(1000))),
    userAgentType: v.optional(userAgentTypeSchema),
    respectCrawlDelay: v.optional(v.boolean()),
    excludedChecks: v.optional(v.array(v.number())),
})

const savedAuditSchema = v.object({
    mask_allow: v.array(v.string()),
    mask_disallow: v.array(v.string()),
    user_agent_type: v.number(),
    status: v.string(),
    scheduleDay: v.number(),
    respectCrawlDelay: v.boolean(),
    pages_limit: v.number(),
})

const auditRunSchema = v.object({
    snapshot_id: v.string(),
})

const issueSchema = v.object({
    id: v.number(),
    count: v.number(),
    delta: v.number(),
    checks: v.number(),
})

const issuesSchema = v.array(issueSchema)

const scoreSchema = v.object({
    value: v.number(),
    delta: v.number(),
})

const auditSchemaReport = v.looseObject({
    id: v.number(),
    pages_limit: v.number(),
    mask_allow: v.array(v.string()),
    mask_disallow: v.array(v.string()),
    user_agent_type: v.optional(userAgentTypeSchema),
    respectCrawlDelay: v.boolean(),
    scheduleDay: v.fallback(v.number(), 0),
    status: v.picklist(["RUNNING", "FINISHED", "CHECKING", "SAVING"]),
    current_snapshot: v.nullable(
        v.looseObject({
            thematicScores: v.object({
                https: scoreSchema,
                intSeo: scoreSchema,
                crawlability: scoreSchema,
                performance: scoreSchema,
                linking: scoreSchema,
                markups: scoreSchema,
            }),
            errors: issuesSchema,
            warnings: issuesSchema,
            notices: issuesSchema,
            snapshot_id: v.string(),
            pages_crawled: v.number(),
            finish_date: v.number(),
            quality: scoreSchema,
        })
    ),
})

const issueReportSchema = v.object({
    limit: v.number(),
    page: v.number(),
    total: v.number(),
    data: v.array(
        v.object({
            target_url: v.string(),
            page_id: v.string(),
            source_url: v.string(),
        })
    ),
    issue_id: v.number(),
})

interface SemrushConfigOptions {
    defaultAuditSettings: Partial<AuditSettings>
}

interface RequestParamters<TSchema extends v.GenericSchema> {
    path: string
    method: "get" | "post" | "delete"
    query?: Record<string, string>
    body?: Record<string, unknown>
    schema: TSchema
}

export interface Authorize {
    url: string
    writeKey: string
    readKey: string
}

export interface Tokens {
    access_token: string
    refresh_token: string
    expires_in: number
    scope: string
    token_type: "Bearer"
}

export interface StoredTokens {
    createdAt: number
    expiredIn: number
    accessToken: string
    refreshToken: string
}

export enum Columns {
    totalResults = "nr",
    keyword = "ph",
    searchVolume = "nq",
    cpc = "cp",
    difficulty = "kd",
}

export interface KeywordSearchSort {
    column: Columns
    order: "asc" | "desc"
}

export type KeyphraseSearchType = "phrase_related" | "phrase_fullsearch" | "phrase_questions"

export interface KeywordSearchOptions {
    keyword: string
    database: string
    offset: number
    limit: number
    type: KeyphraseSearchType
    sort: KeywordSearchSort
}

export type AuditSettings = v.InferOutput<typeof auditSettingsSchema>

export type Issue = v.InferOutput<typeof issueSchema>

export type Project = v.InferOutput<typeof projectSchema>

export default class Semrush {
    static readonly proxyUrl = "https://framer-semrush-proxy.sakibulislam25800.workers.dev/?"
    static readonly apiBaseUrl = `${Semrush.proxyUrl}https://api.semrush.com`
    static readonly baseUrl = `${Semrush.proxyUrl}https://semrush.com`
    private static readonly API_KEY_STORAGE_KEY = "semrushApiKey"

    /**
     * The project ID of the Semrush project assigned to
     * this Framer project via the staging domain
     */
    private projectId!: string
    private apiKey: string | null = null

    /**
     * Default audit settings for enabling and updating audits
     */
    defaultAuditSettings: Partial<AuditSettings>

    constructor({ defaultAuditSettings }: SemrushConfigOptions) {
        this.defaultAuditSettings = defaultAuditSettings
    }

    /**
     * Sends a request to the Semrush v3 Projects API
     */
    private async request<TSchema extends v.GenericSchema>({
        path,
        method,
        query,
        body,
        schema,
    }: RequestParamters<TSchema>): Promise<v.InferOutput<TSchema>> {
        // If the body is empty, don't send the body in the HTTP request
        const bodyAsJsonString = !body || Object.entries(body).length === 0 ? undefined : JSON.stringify(body)

        const apiKey = this.auth.getApiKeyOrThrow()
        const url = new URL(`${Semrush.apiBaseUrl}${path}?key=${apiKey}`)

        if (query) {
            Object.keys(query).forEach(key => url.searchParams.append(key, query[key]))
        }

        const headers: Record<string, string> = {}

        if (bodyAsJsonString) {
            headers["content-type"] = "application/json"
        }

        try {
            const res = await fetch(url, {
                method: method.toUpperCase(),
                body: bodyAsJsonString,
                headers,
            })

            if (res.ok && method === "delete") return

            const contentType = res.headers.get("content-type")

            if (contentType && !contentType.includes("application/json")) {
                const textRes = await res.text()
                throw new Error(textRes)
            }

            const jsonRes = await res.json()

            const successResult = v.safeParse(schema, jsonRes)
            if (successResult.success) return successResult.output

            const errorResult = v.safeParse(apiErrorSchema, jsonRes)
            if (errorResult.success) throw new Error(errorResult.output.message)

            throw new Error("Failed to parse Semrush API response")
        } catch (e) {
            const err = e instanceof Error ? e : new Error("Something went wrong")
            throw err
        }
    }

    async setApiKey(apiKey: string) {
        try {
            const res = await fetch(`${Semrush.proxyUrl}https://semrush.com/users/countapiunits.html?key=${apiKey}`)

            const contentType = res.headers.get("content-type")

            if (contentType && contentType.includes("application/json")) {
                throw new Error("Invalid API key")
            }

            const textRes = await res.text()
            const apiUnitCount = Number(textRes)

            if (apiUnitCount === 0) {
                throw new Error("Insufficient API units.")
            }

            this.apiKey = apiKey

            return true
        } catch (e) {
            const err = e instanceof Error ? e : new Error("Something went wrong")
            throw err
        }
    }

    async getOrCreateProject(domain: string) {
        const projects = await this.projects.getAll()
        let connectedProject = projects.find(p => p.url === domain)
        let siteAuditEnabled = false

        if (!connectedProject) {
            // Default the project name to their domain
            connectedProject = await this.projects.create(domain, domain)
        } else {
            // Check if the site audit tool is enabled for the existing project
            siteAuditEnabled = connectedProject.tools.some(tool => tool.tool === "siteaudit")
        }

        this.projectId = String(connectedProject.project_id)

        if (!siteAuditEnabled) {
            // Set an arbitrary page limit
            await this.audit.enable({ pageLimit: 100, domain })
        }

        return connectedProject
    }

    /**
     * Get keyphrases from Semrush
     */
    public async getKeyphrases({ keyword, database, offset, limit, type, sort }: KeywordSearchOptions) {
        try {
            const apiKey = this.auth.getApiKeyOrThrow()
            const params: Record<string, string> = {
                database,
                phrase: keyword.trim().replace(/ /g, "+"),
                display_limit: String(limit),
                display_offset: String(offset),
                export_columns: "Nr,Ph,In,Nq,Cp,Td,Kd",
                display_sort: `${sort.column}_${sort.order}`,
                key: apiKey,
            }

            const query = Object.keys(params)
                .map(key => `${key}=${params[key]}`)
                .join("&")

            const res = await fetch(`${Semrush.apiBaseUrl}/${type}?${query}`)
            const textRes = await res.text()

            if (textRes.includes("ERROR")) {
                if (textRes.includes("ERROR 50")) {
                    return []
                }

                throw new Error(textRes)
            }

            const keywordsJSON = this.utils.convertCSVToJSON(textRes)
            const result = v.safeParse(keywordsTableSchema, keywordsJSON)

            if (!result.success) {
                throw new Error("Failed to parse keyword search data.")
            }

            return result.output
        } catch (e) {
            throw e instanceof Error ? e : new Error("Something went wrong")
        }
    }

    public readonly auth = {
        setApiKey: async (apiKey: string): Promise<boolean> => {
            try {
                const res = await fetch(`${Semrush.proxyUrl}https://semrush.com/users/countapiunits.html?key=${apiKey}`)

                const contentType = res.headers.get("content-type")
                if (contentType && contentType.includes("application/json")) {
                    throw new Error("Invalid API key")
                }

                const textRes = await res.text()
                const apiUnitCount = Number(textRes)

                if (apiUnitCount === 0) {
                    throw new Error("Insufficient API units.")
                }

                this.apiKey = apiKey
                localStorage.setItem(Semrush.API_KEY_STORAGE_KEY, apiKey)

                return true
            } catch (e) {
                const err = e instanceof Error ? e : new Error("Something went wrong")
                throw err
            }
        },

        getApiKey: (): string | null => {
            if (this.apiKey) return this.apiKey

            const storedApiKey = localStorage.getItem(Semrush.API_KEY_STORAGE_KEY)
            if (storedApiKey) {
                this.apiKey = storedApiKey
                return storedApiKey
            }

            return null
        },

        getApiKeyOrThrow: (): string => {
            const apiKey = this.auth.getApiKey()
            if (!apiKey) throw new Error("Semrush API key missing")
            return apiKey
        },

        clearApiKey: () => {
            this.apiKey = null
            localStorage.removeItem(Semrush.API_KEY_STORAGE_KEY)
        },

        isAuthenticated: (): boolean => {
            return !!this.auth.getApiKey()
        },
    }

    public readonly projects = {
        /**
         * Create a new project
         */
        create: (projectName: string, hostname: string) => {
            return this.request({
                path: "/management/v1/projects",
                method: "post",
                body: {
                    project_name: projectName,
                    url: hostname,
                },
                schema: projectSchema,
            })
        },

        /**
         * Get all projects for the associated account
         */
        getAll: () => {
            return this.request({
                path: "/management/v1/projects",
                method: "get",
                schema: v.array(projectSchema),
            })
        },

        /**
         * Delete the corresponding Semrush project
         */
        delete: () => {
            return this.request({
                path: `/management/v1/projects/${this.projectId}`,
                method: "delete",
                schema: v.null_(),
            })
        },
    }

    public readonly audit = {
        /**
         * Get the project's latest audit report and settings
         */
        get: () => {
            return this.request({
                path: `/reports/v1/projects/${this.projectId}/siteaudit/info`,
                method: "get",
                schema: auditSchemaReport,
            })
        },

        /**
         * Enable the project's site audit tool feature
         */
        enable: async (settings: AuditSettings) => {
            return this.request({
                path: `/management/v1/projects/${this.projectId}/siteaudit/enable`,
                method: "post",
                schema: auditEnabledSchema,
                body: {
                    ...this.defaultAuditSettings,
                    ...settings,
                },
            })
        },

        /**
         * Update the project's site audit settings
         */
        update: async (settings: AuditSettings) => {
            return this.request({
                path: `/management/v1/projects/${this.projectId}/siteaudit/save`,
                method: "post",
                schema: savedAuditSchema,
                body: {
                    ...this.defaultAuditSettings,
                    ...settings,
                },
            })
        },

        /**
         * Run a site audit on the current Framer project
         */
        run: () => {
            return this.request({
                path: `/reports/v1/projects/${this.projectId}/siteaudit/launch`,
                method: "post",
                schema: auditRunSchema,
            })
        },

        /**
         * Get a detailed report of an issue
         */
        getIssueReport: (snapshotId: string, issueId: number) => {
            return this.request({
                path: `/reports/v1/projects/{ID}/siteaudit/snapshot/${snapshotId}/issue/${issueId}`,
                method: "get",
                schema: issueReportSchema,
            })
        },
    }

    private utils = {
        convertCSVToJSON: (data: string) => {
            const rows = data.split("\n")
            const headers = rows[0].split(";")
            rows.shift()

            return rows.map(row => {
                const rowData = row.split(";")
                const obj: Record<string, string> = {}

                headers.forEach((header, index) => {
                    obj[header.trim()] = rowData[index].trim()
                })

                return obj
            })
        },
    }
}
