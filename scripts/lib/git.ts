import { execFileSync } from "node:child_process"
import type { Environment } from "./env"
import { log } from "./logging"

export function createGitTag(pluginName: string, version: number, repoRoot: string, env: Environment): void {
    const tagName = `${pluginName.toLowerCase().replace(/\s+/g, "-")}-v${version.toString()}`

    log.info(`Creating git tag: ${tagName}`)

    try {
        // Delete existing tag if it exists (e.g., from a rejected submission)
        try {
            execFileSync("git", ["tag", "-d", tagName], { cwd: repoRoot, stdio: "pipe" })
            execFileSync("git", ["push", "origin", "--delete", tagName], { cwd: repoRoot, stdio: "pipe" })
        } catch {
            // Tag doesn't exist, that's fine
        }

        execFileSync("git", ["tag", "-a", tagName, "-m", env.CHANGELOG.trim()], {
            cwd: repoRoot,
            stdio: "inherit",
        })

        execFileSync("git", ["push", "origin", tagName], {
            cwd: repoRoot,
            stdio: "inherit",
        })

        log.success(`Tag ${tagName} created and pushed`)
    } catch (error) {
        // Don't fail the whole process if tagging fails
        log.error(`Failed to create/push tag: ${error instanceof Error ? error.message : String(error)}`)
    }
}
