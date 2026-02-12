#!/usr/bin/env yarn tsx

/**
 * Validates PR body for changelog content.
 * Used by the Shippy workflow to check PRs with "Submit on merge" label.
 *
 * Usage: yarn tsx scripts/validate-pr-body.ts
 *
 * Environment Variables:
 *   PR_BODY         - The PR body text to validate
 *   REQUIRE_CHANGELOG - Set to "true" to require changelog (when Submit on merge label is present)
 *
 * Exit codes:
 *   0 - Validation passed
 *   1 - Validation failed
 */

import { appendFileSync } from "fs"
import { extractChangelog } from "./lib/parse-pr"

const prBody = process.env.PR_BODY?.trim()
const requireChangelog = process.env.REQUIRE_CHANGELOG === "true"

if (!prBody) {
    console.log("❌ PR description is required.")
    process.exit(1)
}

const changelog = extractChangelog(prBody)

// Write GitHub Actions output (no-op outside CI)
const outputFile = process.env.GITHUB_OUTPUT
if (outputFile) {
    appendFileSync(outputFile, `has_changelog=${changelog ? "true" : "false"}\n`)
}

if (requireChangelog && !changelog) {
    console.log(
        "❌ Changelog required when 'Submit on merge' label is applied. Add content to the '### Changelog' section in your PR description."
    )
    process.exit(1)
}

console.log("PR body validation passed")
