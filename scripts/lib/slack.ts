import type { Environment } from "./env"
import { getURL } from "./env"
import type { FramerJson, SubmissionResponse } from "./framer-api"
import { log } from "./logging"

interface SlackWorkflowPayload {
    pluginName: string
    retoolUrl?: string
    marketplacePreviewUrl: string
    pluginVersion: string
    pluginReviewUrl: string
    changelog: string
}

export async function sendSlackNotification(
    framerJson: FramerJson,
    submissionResult: SubmissionResponse,
    env: Environment,
    changelog: string
): Promise<void> {
    const payload: SlackWorkflowPayload = {
        pluginName: framerJson.name,
        pluginVersion: submissionResult.version.toString(),
        marketplacePreviewUrl: `${getURL(env, "marketplaceBaseUrl")}/plugins/${submissionResult.slug}/preview`,
        pluginReviewUrl: `${getURL(env, "framerAppUrl")}/projects/new?plugin=${submissionResult.internalPluginId}&pluginVersion=${submissionResult.versionId}`,
        changelog: changelog,
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

export async function sendErrorNotification(
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
