/**
 * Utilities for parsing import statements and extracting package information.
 */

export interface ImportInfo {
    type: "npm" | "url"
    name: string
    raw: string
}

/**
 * Extract npm and URL-based imports from source code.
 */
export function extractImports(code: string): ImportInfo[] {
    const imports: ImportInfo[] = []
    const seen = new Set<string>()

    const npmRegex = /import\s+(?:(?:\*\s+as\s+\w+)|(?:\w+)|(?:\{[^}]*\}))\s+from\s+['"]([^./][^'"]+)['"]/g
    const urlRegex = /import\s+(?:(?:\*\s+as\s+\w+)|(?:\w+)|(?:\{[^}]*\}))\s+from\s+['"]https?:\/\/[^'"]+['"]/g

    let match: RegExpExecArray | null

    while ((match = npmRegex.exec(code)) !== null) {
        const pkgName = match[1]
        const normalized = pkgName.startsWith("@") ? pkgName.split("/").slice(0, 2).join("/") : pkgName.split("/")[0]

        if (!seen.has(normalized)) {
            seen.add(normalized)
            imports.push({
                type: "npm",
                name: normalized,
                raw: match[0],
            })
        }
    }

    while ((match = urlRegex.exec(code)) !== null) {
        const pkgName = extractPackageFromUrl(match[0])
        if (pkgName && !seen.has(pkgName)) {
            seen.add(pkgName)
            imports.push({
                type: "url",
                name: pkgName,
                raw: match[0],
            })
        }
    }

    return imports
}

/**
 * Attempt to derive an npm-style package specifier from a URL import.
 */
export function extractPackageFromUrl(url: string): string | null {
    const match = /\/(@?[^@/]+(?:\/[^@/]+)?)/.exec(url)
    return match?.[1] ?? null
}
