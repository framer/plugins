import { describe, expect, it } from "vitest"
import { extractChangelog, parseChangedPlugins } from "./parse-pr"

describe("extractChangelog", () => {
    it("extracts changelog content from PR body", () => {
        const prBody = `### Description

This PR adds a new feature.

### Changelog

- Added support for multiple locations
- Fixed bug with slug generation

### Testing

- Test case 1`

        expect(extractChangelog(prBody)).toBe(
            "- Added support for multiple locations\n- Fixed bug with slug generation"
        )
    })

    it("returns null for empty PR body", () => {
        expect(extractChangelog("")).toBeNull()
        expect(extractChangelog(null as unknown as string)).toBeNull()
    })

    it("returns null when changelog section is missing", () => {
        const prBody = `### Description

This PR adds a new feature.

### Testing

- Test case 1`

        expect(extractChangelog(prBody)).toBeNull()
    })

    it("returns null when changelog is just a placeholder dash", () => {
        const prBody = `### Description

This PR adds a new feature.

### Changelog

-

### Testing

- Test case 1`

        expect(extractChangelog(prBody)).toBeNull()
    })

    it("returns null when changelog section is empty", () => {
        const prBody = `### Description

This PR adds a new feature.

### Changelog

### Testing

- Test case 1`

        expect(extractChangelog(prBody)).toBeNull()
    })

    it("handles changelog at end of PR body (no following section)", () => {
        const prBody = `### Description

This PR adds a new feature.

### Changelog

- Fixed a critical bug
- Improved performance`

        expect(extractChangelog(prBody)).toBe("- Fixed a critical bug\n- Improved performance")
    })

    it("handles ## headings after changelog", () => {
        const prBody = `### Description

This PR adds a new feature.

### Changelog

- Added new feature

## Additional Notes

Some notes here.`

        expect(extractChangelog(prBody)).toBe("- Added new feature")
    })

    it("is case insensitive for heading", () => {
        const prBody = `### CHANGELOG

- Fixed bug`

        expect(extractChangelog(prBody)).toBe("- Fixed bug")
    })

    it("supports plain text content (not just bullet lists)", () => {
        const prBody = `### Changelog

Fixed a critical bug in the authentication flow that was causing users to be logged out unexpectedly.

### Testing`

        expect(extractChangelog(prBody)).toBe(
            "Fixed a critical bug in the authentication flow that was causing users to be logged out unexpectedly."
        )
    })

    it("trims whitespace from changelog content", () => {
        const prBody = `### Changelog

   - Added feature with extra whitespace

### Testing`

        expect(extractChangelog(prBody)).toBe("- Added feature with extra whitespace")
    })

    it("extracts changelog with HTML comments (PR template)", () => {
        const prBody = `### Description

MAde some changes

### Changelog

<!-- Required when using the "Submit on merge" label. Describe user-facing changes in bullet points. -->

- Just testing changelog extraction
- I hope its formatted nicely
- It better be

### Testing

<!-- List of steps to verify the code this pull request changed. If it is a Plugin additions, what are the core workflows to test. If it is a bug fix, what are the steps to verify it is fixed -->

- [x] Description of test case one
  - [x] Step 1
  - [x] Step 2
  - [x] Step 3
- [x] Description of test case two
  - [x] Step 1
  - [x] Step 2
  - [x] Step 3

<!-- Thank you for contributing! -->`

        const result = extractChangelog(prBody)
        expect(result).toContain("- Just testing changelog extraction")
        expect(result).toContain("- I hope its formatted nicely")
        expect(result).toContain("- It better be")
    })

    it("handles PR body with leading whitespace from YAML indentation", () => {
        // This simulates what happens when YAML heredoc adds indentation
        // The regex still matches, but captures too much because indented headings
        // don't match the lookahead pattern
        const prBody = `          ### Description

          MAde some changes

          ### Changelog

          <!-- Required when using the "Submit on merge" label. -->

          - Just testing changelog extraction

          ### Testing`

        const result = extractChangelog(prBody)
        // It finds content (not null) but includes ### Testing because it's indented
        expect(result).toContain("Just testing changelog extraction")
        // Bug: indented ### Testing is included because lookahead doesn't match
        expect(result).toContain("### Testing")
    })

    it("handles CRLF line endings from GitHub API", () => {
        // GitHub's API can return PR bodies with Windows-style line endings
        const prBody =
            "### Description\r\n\r\nSome description\r\n\r\n### Changelog\r\n\r\n- Item one\r\n- Item two\r\n\r\n### Testing\r\n\r\n- Test case"

        const result = extractChangelog(prBody)
        expect(result).toContain("- Item one")
        expect(result).toContain("- Item two")
        expect(result).not.toContain("### Testing")
    })

    it("strips HTML comments from changelog", () => {
        const prBody = `### Changelog

<!-- This comment should be removed -->

- Actual changelog item

### Testing`

        const result = extractChangelog(prBody)
        expect(result).toBe("- Actual changelog item")
        expect(result).not.toContain("<!--")
        expect(result).not.toContain("-->")
    })
})

describe("parseChangedPlugins", () => {
    it("extracts plugin names from changed files", () => {
        const changedFiles = "plugins/csv-import/src/index.ts plugins/csv-import/package.json"
        expect(parseChangedPlugins(changedFiles)).toEqual(["csv-import"])
    })

    it("returns unique plugin names when multiple files changed in same plugin", () => {
        const changedFiles = "plugins/airtable/src/App.tsx plugins/airtable/src/utils.ts plugins/airtable/package.json"
        expect(parseChangedPlugins(changedFiles)).toEqual(["airtable"])
    })

    it("returns multiple plugins sorted alphabetically", () => {
        const changedFiles = "plugins/csv-import/src/index.ts plugins/airtable/src/App.tsx plugins/ashby/framer.json"
        expect(parseChangedPlugins(changedFiles)).toEqual(["airtable", "ashby", "csv-import"])
    })

    it("ignores files outside plugins directory", () => {
        const changedFiles =
            "scripts/submit-plugin.ts packages/plugin-tools/src/index.ts plugins/csv-import/src/index.ts README.md"
        expect(parseChangedPlugins(changedFiles)).toEqual(["csv-import"])
    })

    it("returns empty array when no plugin files changed", () => {
        const changedFiles = "scripts/submit-plugin.ts README.md .github/workflows/ci.yml"
        expect(parseChangedPlugins(changedFiles)).toEqual([])
    })

    it("returns empty array for empty input", () => {
        expect(parseChangedPlugins("")).toEqual([])
        expect(parseChangedPlugins("   ")).toEqual([])
    })

    it("handles files at root of plugins directory (should not match)", () => {
        // Files directly in plugins/ without a subdirectory should not match
        const changedFiles = "plugins/.DS_Store plugins/README.md"
        expect(parseChangedPlugins(changedFiles)).toEqual([])
    })

    it("handles deeply nested files", () => {
        const changedFiles = "plugins/airtable/src/components/Button/index.tsx"
        expect(parseChangedPlugins(changedFiles)).toEqual(["airtable"])
    })

    it("handles newline-separated files", () => {
        const changedFiles = "plugins/csv-import/src/index.ts\nplugins/airtable/src/App.tsx"
        expect(parseChangedPlugins(changedFiles)).toEqual(["airtable", "csv-import"])
    })

    it("handles tab-separated files", () => {
        const changedFiles = "plugins/csv-import/src/index.ts\tplugins/airtable/src/App.tsx"
        expect(parseChangedPlugins(changedFiles)).toEqual(["airtable", "csv-import"])
    })
})
