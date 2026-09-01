import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import * as v from "valibot"
import { changelogToHtml } from "./changelog"
import type { Environment } from "./env"
import { getURL } from "./env"
import { log } from "./logging"

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
export type Plugin = v.InferOutput<typeof PluginSchema>

const PluginsResponseSchema = v.object({
    plugins: v.array(PluginSchema),
})

const SubmissionResponseSchema = v.object({
    version: v.number(),
    versionId: v.string(),
    internalPluginId: v.string(),
    slug: v.string(),
})
export type SubmissionResponse = v.InferOutput<typeof SubmissionResponseSchema>

/** The Creators Service wraps every response, so the release details sit under `data`. */
const ReleaseResponseSchema = v.object({
    data: SubmissionResponseSchema,
})

export const FramerJsonSchema = v.object({
    id: v.string(),
    name: v.string(),
})
export type FramerJson = v.InferOutput<typeof FramerJsonSchema>

export async function getAccessToken(env: Environment): Promise<string> {
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

export async function fetchMyPlugins(env: Environment): Promise<Plugin[]> {
    const accessToken = await getAccessToken(env)

    const response = await fetch(`${getURL(env, "apiBase")}/site/v1/plugins/me?limit=100`, {
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

export function loadFramerJsonFile(pluginPath: string): FramerJson {
    const framerJsonPath = join(pluginPath, "framer.json")

    if (!existsSync(framerJsonPath)) {
        throw new Error(`framer.json not found at ${framerJsonPath}`)
    }

    const framerJson = v.parse(FramerJsonSchema, JSON.parse(readFileSync(framerJsonPath, "utf-8")))

    return framerJson
}

/**
 * Two calls, because the zip goes to the plugins API and only the resulting
 * version id goes to the marketplace. The version is left pending for a human
 * to approve.
 */
export async function submitPlugin(
    zipFilePath: string,
    plugin: Plugin,
    env: Environment,
    changelog: string
): Promise<SubmissionResponse> {
    const accessToken = await getAccessToken(env)
    const releaseNotes = await changelogToHtml(changelog)

    const versionId = await uploadPluginVersion(zipFilePath, plugin, env, accessToken, releaseNotes)
    const result = await submitToMarketplace(plugin, env, accessToken, versionId)

    log.success(`Submitted! Version: ${result.version}`)

    return result
}

async function uploadPluginVersion(
    zipFilePath: string,
    plugin: Plugin,
    env: Environment,
    accessToken: string,
    releaseNotes: string
): Promise<string> {
    const url = `${getURL(env, "apiBase")}/site/v1/plugins/${plugin.id}/versions`

    log.info(`Uploading to: ${url}`)

    const zipBuffer = readFileSync(zipFilePath)
    const formData = new FormData()
    formData.append("file", new Blob([zipBuffer], { type: "application/zip" }), "plugin.zip")
    formData.append("releaseNotes", releaseNotes)

    const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Plugin upload failed: ${response.status} ${response.statusText}\n${errorText}`)
    }

    const version = v.parse(PluginVersionSchema, await response.json())

    return version.id
}

async function submitToMarketplace(
    plugin: Plugin,
    env: Environment,
    accessToken: string,
    versionId: string
): Promise<SubmissionResponse> {
    const url = `${getURL(env, "apiBase")}/creators/v1/resources/plugin/${plugin.id}/release`

    log.info(`Submitting to: ${url}`)

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "x-requested-by": "plugin-release-action",
        },
        body: JSON.stringify({ versionId }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Marketplace submission failed: ${response.status} ${response.statusText}\n${errorText}`)
    }

    const body = v.parse(ReleaseResponseSchema, await response.json())

    return body.data
}
