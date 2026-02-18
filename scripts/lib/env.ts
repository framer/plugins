import * as v from "valibot"

export const FramerEnvSchema = v.picklist(["production", "development"])

export const BooleanEnvSchema = v.pipe(
    v.optional(v.string(), "false"),
    v.transform(val => ["true", "1", "yes"].includes(val.toLowerCase()))
)

export const EnvSchema = v.object({
    PLUGIN_PATH: v.pipe(v.string(), v.minLength(1)),
    CHANGELOG: v.optional(v.pipe(v.string(), v.minLength(1))),
    PR_BODY: v.optional(v.string()),
    SLACK_WEBHOOK_URL: v.optional(v.string()),
    SLACK_ERROR_WEBHOOK_URL: v.optional(v.string()),
    RETOOL_URL: v.optional(v.string()),
    GITHUB_RUN_URL: v.optional(v.string()),
    FRAMER_ENV: v.optional(FramerEnvSchema, "production"),
    DRY_RUN: BooleanEnvSchema,
    REPO_ROOT: v.optional(v.string()),
    SESSION_TOKEN: v.pipe(v.string(), v.minLength(1)),
    FRAMER_ADMIN_SECRET: v.pipe(v.string(), v.minLength(1)),
})

export type FramerEnv = v.InferOutput<typeof FramerEnvSchema>
export type Environment = v.InferOutput<typeof EnvSchema>

export interface EnvironmentUrls {
    apiBase: string
    creatorsApiBase: string
    framerAppUrl: string
    marketplaceBaseUrl: string
}

export const ENVIRONMENT_URLS: Record<FramerEnv, EnvironmentUrls> = {
    production: {
        apiBase: "https://api.framer.com",
        creatorsApiBase: "https://framer.com/marketplace/api",
        framerAppUrl: "https://framer.com",
        marketplaceBaseUrl: "https://framer.com/marketplace",
    },
    development: {
        apiBase: "https://api.development.framer.com",
        creatorsApiBase: "https://marketplace.development.framer.com",
        framerAppUrl: "https://development.framer.com",
        marketplaceBaseUrl: "https://marketplace.development.framer.com/marketplace",
    },
}

export function getURL(env: Environment, key: keyof EnvironmentUrls): string {
    return ENVIRONMENT_URLS[env.FRAMER_ENV][key]
}

export function getEnvironment(): Environment {
    const result = v.safeParse(EnvSchema, process.env)

    if (!result.success) {
        const issues = result.issues.map(issue => {
            const path = issue.path?.map(p => p.key).join(".") ?? "unknown"
            return `${path}: ${issue.message}`
        })
        throw new Error(`Invalid environment variables:\n${issues.join("\n")}`)
    }

    return result.output
}
