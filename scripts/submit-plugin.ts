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

import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { runPluginBuildScript, zipPluginDistribution } from "framer-plugin-tools"
import { getEnvironment, getURL } from "./lib/env"
import type { FramerJson } from "./lib/framer-api"
import { fetchMyPlugins, loadFramerJsonFile, submitPlugin } from "./lib/framer-api"
import { createGitTag } from "./lib/git"
import { log } from "./lib/logging"
import { sendErrorNotification, sendSlackNotification } from "./lib/slack"

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

        // Fetch user's plugins to find the database plugin ID
        log.step("Fetching Plugin from Framer")

        // Ideally an endpoint to fetch a plugin by manifest ID is available in FramerPluginService but it does not
        // exist yet. Fetching all plugins could fail in the future but we fetch the first 100 plugins so it should be
        // okay at the moment
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
