#!/usr/bin/env yarn tsx

/**
 * Submit on Merge Script
 *
 * Orchestrates multi-plugin submission by detecting changed plugins from a PR
 * and calling submit-plugin.ts for each one with the changelog from the PR body.
 *
 * Usage: yarn tsx scripts/submit-on-merge.ts
 *
 * Environment Variables:
 *   PR_BODY_FILE   - Path to file containing PR body text
 *   CHANGED_FILES  - Space-separated list of changed files from the workflow
 *   REPO_ROOT      - Root of the git repository (optional, defaults to parent of scripts/)
 *
 * Plus all environment variables required by submit-plugin.ts:
 *   SESSION_TOKEN, FRAMER_ADMIN_SECRET, SLACK_WEBHOOK_URL, etc.
 */

import { execSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { log } from "./lib/logging"
import { extractChangelog, parseChangedPlugins } from "./lib/parse-pr"

const REPO_ROOT = process.env.REPO_ROOT ?? resolve(__dirname, "..")
const PLUGINS_DIR = join(REPO_ROOT, "plugins")

function getChangedPlugins(changedFiles: string): string[] {
    // Parse plugin names from changed files (pure function from lib)
    const pluginNames = parseChangedPlugins(changedFiles)

    // Filter to only plugins that have framer.json (valid plugins)
    const validPlugins: string[] = []
    for (const name of pluginNames) {
        const framerJsonPath = join(PLUGINS_DIR, name, "framer.json")
        if (existsSync(framerJsonPath)) {
            validPlugins.push(name)
        } else {
            log.warn(`Skipping ${name}: no framer.json found`)
        }
    }

    return validPlugins
}

function submitPlugin(pluginName: string, changelog: string): void {
    const pluginPath = join(PLUGINS_DIR, pluginName)

    log.step(`Submitting plugin: ${pluginName}`)
    log.info(`Path: ${pluginPath}`)

    try {
        execSync("yarn tsx scripts/submit-plugin.ts", {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                PLUGIN_PATH: pluginPath,
                CHANGELOG: changelog,
                REPO_ROOT: REPO_ROOT,
            },
            stdio: "inherit",
        })
        log.success(`Plugin ${pluginName} submitted successfully`)
    } catch (error) {
        // execSync throws on non-zero exit, re-throw to stop the process
        throw new Error(
            `Failed to submit plugin ${pluginName}: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}

function run(): void {
    console.log("=".repeat(60))
    console.log("Submit on Merge - Multi-Plugin Submission")
    console.log("=".repeat(60))

    // 1. Validate required environment variables
    log.step("Configuration")
    const prBodyFile = process.env.PR_BODY_FILE
    const changedFiles = process.env.CHANGED_FILES

    if (!prBodyFile) {
        throw new Error("Missing required environment variable: PR_BODY_FILE")
    }

    if (!changedFiles) {
        throw new Error("Missing required environment variable: CHANGED_FILES")
    }

    if (!existsSync(prBodyFile)) {
        throw new Error(`PR_BODY_FILE does not exist: ${prBodyFile}`)
    }

    const prBody = readFileSync(prBodyFile, "utf-8")

    log.info(`Dry run: ${process.env.DRY_RUN === "true" ? "yes" : "no"}`)
    log.debug(`PR body file: ${prBodyFile}`)
    log.debug(`PR body length: ${prBody.length} chars`)
    log.debug(`PR body (first 500 chars):\n${prBody.slice(0, 500)}`)

    // 2. Extract changelog from PR body
    log.step("Extracting Changelog")
    const changelog = extractChangelog(prBody)
    log.debug(`Extracted changelog: ${changelog ? `"${changelog.slice(0, 200)}..."` : "null"}`)

    if (!changelog) {
        log.error(`Full PR body for debugging:\n---\n${prBody}\n---`)
        throw new Error("No changelog found in PR body. Expected a '### Changelog' section with content.")
    }

    log.info(`Changelog:\n${changelog}`)

    // 3. Detect changed plugins
    log.step("Detecting Changed Plugins")
    const plugins = getChangedPlugins(changedFiles)

    if (plugins.length === 0) {
        log.warn("No valid plugins found in changed files. Nothing to submit.")
        return
    }

    log.info(`Found ${plugins.length} plugin(s) to submit: ${plugins.join(", ")}`)

    // 4. Submit each plugin sequentially
    log.step("Submitting Plugins")
    let successCount = 0
    let failCount = 0

    for (const plugin of plugins) {
        try {
            submitPlugin(plugin, changelog)
            successCount++
        } catch (error) {
            failCount++
            log.error(`Failed to submit ${plugin}: ${error instanceof Error ? error.message : String(error)}`)
            // Continue with other plugins instead of stopping
        }
    }

    // 5. Summary
    console.log("\n" + "=".repeat(60))
    if (failCount === 0) {
        log.success(`All ${successCount} plugin(s) submitted successfully!`)
    } else {
        log.error(`Completed with errors: ${successCount} succeeded, ${failCount} failed`)
        process.exit(1)
    }
    console.log("=".repeat(60))
}

try {
    run()
} catch (error) {
    log.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
}
