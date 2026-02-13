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

export async function submitPlugin(zipFilePath: string, plugin: Plugin, env: Environment): Promise<SubmissionResponse> {
    if (!env.SESSION_TOKEN || !env.FRAMER_ADMIN_SECRET) {
        throw new Error("Session token and Framer admin secret are required for submission")
    }

    const url = `${getURL(env, "creatorsApiBase")}/api/admin/plugin/${plugin.id}/versions/`

    log.info(`Submitting to: ${url}`)

    const zipBuffer = readFileSync(zipFilePath)
    const blob = new Blob([zipBuffer], { type: "application/zip" })

    const formData = new FormData()
    formData.append("file", blob, "plugin.zip")
    formData.append("content", await changelogToHtml(env.CHANGELOG))

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
