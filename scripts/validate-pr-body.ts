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

import { extractChangelog } from "./lib/parse-pr"

const prBody = process.env.PR_BODY?.trim()
const requireChangelog = process.env.REQUIRE_CHANGELOG === "true"

if (!prBody) {
    console.log("❌ PR description is required.")
    process.exit(1)
}

if (requireChangelog) {
    const changelog = extractChangelog(prBody)

    if (!changelog) {
        console.log(
            "❌ Changelog required when 'Submit on merge' label is applied. Add content to the '### Changelog' section in your PR description."
        )
        process.exit(1)
    }

    console.log("Changelog validation passed")
}

console.log("PR body validation passed")
