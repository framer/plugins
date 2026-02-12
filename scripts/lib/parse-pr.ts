/**
 * Pure functions for parsing PR data.
 * These are extracted for testability.
 */

/**
 * Extracts the changelog content from a PR body.
 * Looks for a "### Changelog" section and extracts content until the next heading.
 *
 * @param prBody - The full PR body text
 * @returns The changelog content, or null if not found or empty
 */
export function extractChangelog(prBody: string): string | null {
    if (!prBody) {
        return null
    }

    // Normalize line endings (GitHub API can return CRLF)
    const normalizedBody = prBody.replace(/\r\n/g, "\n")

    // Match ### Changelog section until next heading (## or ###) or end of string
    // Use [ \t]* instead of \s* to avoid matching newlines before the capture group
    const changelogPattern = /### Changelog[ \t]*\n([\s\S]*?)(?=\n### |\n## |$)/i
    const match = changelogPattern.exec(normalizedBody)
    let changelog = match?.[1]?.trim()

    if (!changelog || changelog === "-") {
        return null
    }

    // Strip HTML comments (from PR templates)
    changelog = changelog.replace(/<!--[\s\S]*?-->/g, "").trim()

    if (!changelog || changelog === "-") {
        return null
    }

    return changelog
}

/**
 * Parses a list of changed file paths and extracts unique plugin names.
 * Only includes files under the `plugins/` directory.
 *
 * @param changedFiles - Space-separated list of changed file paths
 * @returns Array of unique plugin directory names, sorted alphabetically
 */
export function parseChangedPlugins(changedFiles: string): string[] {
    if (!changedFiles) {
        return []
    }

    const files = changedFiles.split(/\s+/).filter(Boolean)
    const pluginNames = new Set<string>()

    for (const file of files) {
        // Match files in plugins/* directory (e.g., "plugins/csv-import/src/index.ts")
        const match = /^plugins\/([^/]+)\//.exec(file)
        if (match?.[1]) {
            pluginNames.add(match[1])
        }
    }

    return Array.from(pluginNames).sort()
}
