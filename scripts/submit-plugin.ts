#!/usr/bin/env yarn tsx

/**
 * Plugin Submission Script
 *
 * Builds, packs, and submits a plugin to the Framer marketplace.
 *
 * Usage: yarn tsx scripts/submit-plugin.ts
 *
 * Environment Variables:
 *   PLUGIN_PATH         - Path to the plugin directory (required)
 *   CHANGELOG           - Changelog text (required)
 *   SESSION_TOKEN       - Framer session cookie (required unless DRY_RUN)
 *   FRAMER_ADMIN_SECRET - Framer admin API key (required unless DRY_RUN)
 *   SLACK_WEBHOOK_URL   - Slack workflow webhook for success notifications (optional)
 *   SLACK_ERROR_WEBHOOK_URL - Slack workflow webhook for error notifications (optional)
 *   RETOOL_URL          - Retool dashboard URL for Slack notifications (optional)
 *   GITHUB_RUN_URL      - GitHub Actions run URL for error notifications (optional)
 *   FRAMER_ENV          - Environment: "production" or "development" (default: production)
 *   DRY_RUN             - Skip submission and tagging when "true" (optional)
 *   REPO_ROOT           - Root of the git repository (default: parent of scripts/)
 */

import { execSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { runPluginBuildScript, zipPluginDistribution } from "framer-plugin-tools"
import * as v from "valibot"

// ============================================================================
// Schemas - Environment Variables
// ============================================================================

const FramerEnvSchema = v.picklist(["production", "development"])

const EnvSchema = v.object({
    PLUGIN_PATH: v.pipe(v.string(), v.minLength(1)),
    CHANGELOG: v.pipe(v.string(), v.minLength(1)),
    SLACK_WEBHOOK_URL: v.optional(v.string()),
    SLACK_ERROR_WEBHOOK_URL: v.optional(v.string()),
    RETOOL_URL: v.optional(v.string()),
    GITHUB_RUN_URL: v.optional(v.string()),
    FRAMER_ENV: v.optional(FramerEnvSchema, "production"),
    DRY_RUN: v.optional(v.string()),
    REPO_ROOT: v.optional(v.string()),
    SESSION_TOKEN: v.pipe(v.string(), v.minLength(1)),
    FRAMER_ADMIN_SECRET: v.pipe(v.string(), v.minLength(1)),
})

// ============================================================================
// Schemas - API Responses
// ============================================================================

const AccessTokenResponseSchema = v.object({
    accessToken: v.string(),
    expiresAt: v.string(),
    expiresInSeconds: v.number(),
})

const PluginVersionSchema = v.object({
    id: v.string(),
    name: v.string(),
    modes: v.array(v.string()),
    icon: v.nullable(v.string()),
    prettyVersion: v.number(),
    status: v.string(),
    releaseNotes: v.nullable(v.string()),
    reviewedAt: v.nullable(v.string()),
    url: v.string(),
    createdAt: v.string(),
})

const PluginSchema = v.object({
    id: v.string(),
    manifestId: v.string(),
    description: v.nullable(v.string()),
    ownerType: v.string(),
    ownerId: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
    external: v.boolean(),
    currentVersion: v.nullable(PluginVersionSchema),
    lastCreatedVersion: v.nullable(PluginVersionSchema),
})
type Plugin = v.InferOutput<typeof PluginSchema>

const PluginsResponseSchema = v.object({
    plugins: v.array(PluginSchema),
})

const SubmissionResponseSchema = v.object({
    version: v.number(),
    // FIXME: THIS SHOULD BE DEPLOYED:
    // SEE: https://github.com/framer/creators/pull/2487/files
    versionId: v.fallback(v.string(), ""),
    internalPluginId: v.string(),
    slug: v.string(),
})
type SubmissionResponse = v.InferOutput<typeof SubmissionResponseSchema>

// ============================================================================
// Schemas - File Contents
// ============================================================================

const FramerJsonSchema = v.object({
    id: v.string(),
    name: v.string(),
})

// ============================================================================
// Types
// ============================================================================

type FramerEnv = v.InferOutput<typeof FramerEnvSchema>
type FramerJson = v.InferOutput<typeof FramerJsonSchema>

interface EnvironmentUrls {
    apiBase: string
    creatorsApiBase: string
    framerAppUrl: string
    marketplaceBaseUrl: string
}

type Environment = v.InferOutput<typeof EnvSchema>

const ENVIRONMENT_URLS: Record<FramerEnv, EnvironmentUrls> = {
    production: {
        apiBase: "https://api.framer.com",
        creatorsApiBase: "https://framer.com/marketplace",
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

function getURL(env: Environment, key: keyof EnvironmentUrls): string {
    return ENVIRONMENT_URLS[env.FRAMER_ENV][key]
}

// ============================================================================
// Logging
// ============================================================================

const log = {
    info: (msg: string) => {
        console.log(`[INFO] ${msg}`)
    },
    success: (msg: string) => {
        console.log(`[SUCCESS] ${msg}`)
    },
    error: (msg: string) => {
        console.error(`[ERROR] ${msg}`)
    },
    step: (msg: string) => {
        console.log(`\n=== ${msg} ===`)
    },
}

// ============================================================================
// Configuration
// ============================================================================

function getEnvironment(): Environment {
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

// ============================================================================
// Framer API Operations
// ============================================================================

async function getAccessToken(env: Environment): Promise<string> {
    if (!env.SESSION_TOKEN) {
        throw new Error("Session token is required")
    }

    const response = await fetch(`${getURL(env, "apiBase")}/auth/web/access-token`, {
        headers: {
            Cookie: `session=${env.SESSION_TOKEN}`,
        },
    })

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Session expired. Please update your SESSION_TOKEN.")
        }
        throw new Error(`Failed to get access token: ${response.statusText}`)
    }

    const data = v.parse(AccessTokenResponseSchema, await response.json())
    return data.accessToken
}

async function fetchMyPlugins(env: Environment): Promise<Plugin[]> {
    const accessToken = await getAccessToken(env)

    const response = await fetch(`${getURL(env, "apiBase")}/site/v1/plugins/me`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Session expired. Please update your SESSION_TOKEN.")
        }
        throw new Error(`Failed to fetch plugins: ${response.statusText}`)
    }

    const data = v.parse(PluginsResponseSchema, await response.json())
    return data.plugins
}

// ============================================================================
// Plugin Operations
// ============================================================================

function loadFramerJsonFile(pluginPath: string): FramerJson {
    const framerJsonPath = join(pluginPath, "framer.json")

    if (!existsSync(framerJsonPath)) {
        throw new Error(`framer.json not found at ${framerJsonPath}`)
    }

    const framerJson = v.parse(FramerJsonSchema, JSON.parse(readFileSync(framerJsonPath, "utf-8")))

    return framerJson
}

async function submitPlugin(zipFilePath: string, plugin: Plugin, env: Environment): Promise<SubmissionResponse> {
    if (!env.SESSION_TOKEN || !env.FRAMER_ADMIN_SECRET) {
        throw new Error("Session token and Framer admin secret are required for submission")
    }

    const url = `${getURL(env, "creatorsApiBase")}/api/admin/plugin/${plugin.id}/versions/`

    log.info(`Submitting to: ${url}`)

    const zipBuffer = readFileSync(zipFilePath)
    const blob = new Blob([zipBuffer], { type: "application/zip" })

    const formData = new FormData()
    formData.append("file", blob, "plugin.zip")
    formData.append("content", env.CHANGELOG)

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Cookie: `session=${env.SESSION_TOKEN}`,
            Authorization: `Bearer ${env.FRAMER_ADMIN_SECRET}`,
        },
        body: formData,
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API submission failed: ${response.status} ${response.statusText}\n${errorText}`)
    }

    const result = v.parse(SubmissionResponseSchema, await response.json())
    log.success(`Submitted! Version: ${result.version}`)

    return result
}

// ============================================================================
// Git Tagging
// ============================================================================

function createGitTag(pluginName: string, version: number, repoRoot: string, env: Environment): void {
    const tagName = `${pluginName.toLowerCase().replace(/\s+/g, "-")}-v${version.toString()}`

    log.info(`Creating git tag: ${tagName}`)

    try {
        // Delete existing tag if it exists (e.g., from a rejected submission)
        try {
            execSync(`git tag -d "${tagName}"`, { cwd: repoRoot, stdio: "pipe" })
            execSync(`git push origin --delete "${tagName}"`, { cwd: repoRoot, stdio: "pipe" })
        } catch {
            // Tag doesn't exist, that's fine
        }

        // Create annotated tag with changelog as message
        const escapedChangelog = env.CHANGELOG.trim().replace(/'/g, "'\\''")
        execSync(`git tag -a "${tagName}" -m "${escapedChangelog}"`, {
            cwd: repoRoot,
            stdio: "inherit",
        })

        // Push tag
        execSync(`git push origin "${tagName}"`, {
            cwd: repoRoot,
            stdio: "inherit",
        })

        log.success(`Tag ${tagName} created and pushed`)
    } catch (error) {
        // Don't fail the whole process if tagging fails
        log.error(`Failed to create/push tag: ${error instanceof Error ? error.message : String(error)}`)
    }
}

// ============================================================================
// Slack Notifications
// ============================================================================

interface SlackWorkflowPayload {
    pluginName: string
    retoolUrl?: string
    marketplacePreviewUrl: string
    pluginVersion: string
    pluginReviewUrl: string
    changelog: string
}

async function sendSlackNotification(
    framerJson: FramerJson,
    submissionResult: SubmissionResponse,
    env: Environment
): Promise<void> {
    const payload: SlackWorkflowPayload = {
        pluginName: framerJson.name,
        pluginVersion: submissionResult.version.toString(),
        marketplacePreviewUrl: `${getURL(env, "marketplaceBaseUrl")}/plugins/${submissionResult.slug}/preview`,
        pluginReviewUrl: `${getURL(env, "framerAppUrl")}/projects/new?plugin=${submissionResult.internalPluginId}&pluginVersion=${submissionResult.versionId}`,
        changelog: env.CHANGELOG,
        retoolUrl: env.RETOOL_URL,
    }

    if (!env.SLACK_WEBHOOK_URL) return

    try {
        const response = await fetch(env.SLACK_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            log.error(`Slack notification failed: ${response.status}`)
        } else {
            log.success("Slack notification sent")
        }
    } catch (err) {
        log.error(`Slack notification error: ${err instanceof Error ? err.message : String(err)}`)
    }
}

async function sendErrorNotification(
    errorMessage: string,
    pluginName: string | undefined,
    env: Environment
): Promise<void> {
    if (!env.SLACK_ERROR_WEBHOOK_URL) return

    const payload = {
        githubActionRunUrl: env.GITHUB_RUN_URL ?? "N/A (not running in GitHub Actions)",
        errorMessage,
        pluginName: pluginName ?? "Unknown",
    }

    try {
        const response = await fetch(env.SLACK_ERROR_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            log.error(`Error notification failed: ${response.status}`)
        } else {
            log.success("Error notification sent")
        }
    } catch (err) {
        log.error(`Error notification error: ${err instanceof Error ? err.message : String(err)}`)
    }
}

async function main(): Promise<void> {
    console.log("=".repeat(60))
    console.log("Submitting Plugin to Framer Marketplace")
    console.log("=".repeat(60))

    log.step("Configuration")
    const env = getEnvironment()
    let framerJson: FramerJson | undefined
    // REPO_ROOT can be overridden when script is run from a different repo
    const repoRoot = process.env.REPO_ROOT ?? resolve(__dirname, "..")

    try {
        log.info(`Plugin path: ${env.PLUGIN_PATH}`)
        log.info(`Environment: ${env.FRAMER_ENV}`)
        log.info(`API base: ${getURL(env, "creatorsApiBase")}`)
        log.info(`Dry run: ${String(env.DRY_RUN)}`)

        if (!existsSync(env.PLUGIN_PATH)) {
            throw new Error(`Plugin path does not exist: ${env.PLUGIN_PATH}`)
        }

        log.step("Loading Plugin Info")
        framerJson = loadFramerJsonFile(env.PLUGIN_PATH)
        log.info(`Name: ${framerJson.name}`)
        log.info(`Manifest ID: ${framerJson.id}`)

        // 4. Fetch user's plugins to find the database plugin ID
        log.step("Fetching Plugin from Framer")
        const plugins = await fetchMyPlugins(env)
        const matchedPlugin = plugins.find(p => p.manifestId === framerJson?.id)

        if (!matchedPlugin) {
            throw new Error(
                `No plugin found with manifest ID "${framerJson.id}". ` +
                    `Make sure you have created this plugin on Framer first.`
            )
        }

        const plugin = matchedPlugin
        log.info(`Found plugin with ID: ${plugin.id}`)

        log.step("Changelog")
        log.info(`Changelog:\n${env.CHANGELOG}`)

        log.step("Building & Packing Plugin")

        log.info("Building plugin...")
        await runPluginBuildScript(env.PLUGIN_PATH)

        log.info(`Creating plugin.zip...`)
        const zipFilePath = zipPluginDistribution({
            cwd: env.PLUGIN_PATH,
            distPath: "dist",
            zipFileName: "plugin.zip",
        })

        if (env.DRY_RUN) {
            log.step("DRY RUN - Skipping Submission")
            log.info("Plugin is built and packed. Would submit to API in real run.")
            log.info(`Would submit with changelog:\n${env.CHANGELOG}`)
            return
        }

        log.step("Submitting to Framer API")
        const submissionResult = await submitPlugin(zipFilePath, plugin, env)

        log.step("Creating Git Tag")
        createGitTag(framerJson.name, submissionResult.version, repoRoot, env)

        if (env.SLACK_WEBHOOK_URL) {
            log.step("Sending Slack Notification")
            await sendSlackNotification(framerJson, submissionResult, env)
        }

        console.log("\n" + "=".repeat(60))
        log.success("Done!")
        console.log("=".repeat(60))
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.error(errorMessage)

        if (!env.DRY_RUN) {
            await sendErrorNotification(errorMessage, framerJson?.name, env)
        }

        process.exit(1)
    }
}

void main()
