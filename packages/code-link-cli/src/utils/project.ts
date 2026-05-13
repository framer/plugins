import { shortProjectHash } from "@code-link/shared"
import fs from "fs/promises"
import path from "path"

/** Code Link metadata stored under `package.json` → `codeLink`. */
export interface CodeLinkInPackage {
    shortProjectHash?: string
    framerProjectName?: string
    npmStrategy?: unknown
}

interface PackageJson {
    codeLink?: CodeLinkInPackage
    name?: string
    version?: string
    /** @deprecated migrated into codeLink */
    shortProjectHash?: string
    /** @deprecated migrated into codeLink */
    framerProjectName?: string
    /** @deprecated migrated into codeLink.npmStrategy */
    codeLinkNpmStrategy?: unknown
    [key: string]: unknown
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Reads package.json, migrates legacy top-level Code Link fields into `codeLink`,
 * backfills any provided defaults for missing `codeLink` fields, and persists
 * when anything changed.
 */
export async function readAndMigratePackageJson(
    packageJsonPath: string,
    defaults?: { shortProjectHash?: string; framerProjectName?: string }
): Promise<PackageJson | null> {
    try {
        const raw = await fs.readFile(packageJsonPath, "utf-8")
        const parsed = JSON.parse(raw) as unknown
        if (!isPlainObject(parsed)) {
            return null
        }

        const hadLegacy =
            "shortProjectHash" in parsed ||
            "framerProjectName" in parsed ||
            "codeLinkNpmStrategy" in parsed

        const existing = parsed.codeLink
        const base: Record<string, unknown> = isPlainObject(existing) ? { ...existing } : {}

        if (parsed.shortProjectHash !== undefined && base.shortProjectHash === undefined) {
            base.shortProjectHash = parsed.shortProjectHash
        }
        if (parsed.framerProjectName !== undefined && base.framerProjectName === undefined) {
            base.framerProjectName = parsed.framerProjectName
        }
        if (parsed.codeLinkNpmStrategy !== undefined && base.npmStrategy === undefined) {
            base.npmStrategy = parsed.codeLinkNpmStrategy
        }

        let backfilled = false
        if (defaults?.shortProjectHash !== undefined && base.shortProjectHash === undefined) {
            base.shortProjectHash = defaults.shortProjectHash
            backfilled = true
        }
        if (defaults?.framerProjectName !== undefined && base.framerProjectName === undefined) {
            base.framerProjectName = defaults.framerProjectName
            backfilled = true
        }

        if (!hadLegacy && !backfilled) {
            return parsed as PackageJson
        }

        const next: PackageJson = { ...parsed }
        delete next.shortProjectHash
        delete next.framerProjectName
        delete next.codeLinkNpmStrategy
        next.codeLink = base as CodeLinkInPackage

        await fs.writeFile(packageJsonPath, JSON.stringify(next, null, 4))
        return next
    } catch {
        return null
    }
}

function getShortProjectHashFromPackage(pkg: PackageJson): string | null {
    const short = pkg.codeLink?.shortProjectHash
    return typeof short === "string" ? short : null
}

export function toPackageName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-+/g, "-")
}

export function toDirectoryName(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9 -]/g, "-")
        .trim()
        .replace(/^-+|-+$/g, "")
        .replace(/-+/g, "-")
}

export async function getProjectHashFromCwd(): Promise<string | null> {
    const result = await readAndMigratePackageJson(path.join(process.cwd(), "package.json"))
    if (!result) {
        return null
    }
    return getShortProjectHashFromPackage(result)
}

export async function findOrCreateProjectDirectory(options: {
    projectHash: string
    projectName?: string
    explicitDirectory?: string
    baseDirectory?: string
}): Promise<{ directory: string; created: boolean; nameCollision?: boolean }> {
    const { projectHash, projectName, explicitDirectory, baseDirectory } = options

    const codeLinkDefaults = {
        shortProjectHash: shortProjectHash(projectHash),
        framerProjectName: projectName,
    }

    if (explicitDirectory) {
        const resolved = path.resolve(explicitDirectory)
        await fs.mkdir(path.join(resolved, "files"), { recursive: true })
        await readAndMigratePackageJson(path.join(resolved, "package.json"), codeLinkDefaults)
        return { directory: resolved, created: false }
    }

    const cwd = baseDirectory ?? process.cwd()
    const existing = await findExistingProjectDirectory(cwd, projectHash)
    if (existing) {
        await readAndMigratePackageJson(path.join(existing, "package.json"), codeLinkDefaults)
        return { directory: existing, created: false }
    }

    if (!projectName) {
        throw new Error("Failed to get Project name. Pass --name <project name>.")
    }

    const directoryName = toDirectoryName(projectName)
    const pkgName = toPackageName(projectName)
    const shortId = shortProjectHash(projectHash)
    const baseName = directoryName || `project-${shortId}`
    const { directory: projectDirectory, nameCollision } = await findAvailableDirectory(cwd, baseName, shortId)

    await fs.mkdir(path.join(projectDirectory, "files"), { recursive: true })
    const pkg: PackageJson = {
        name: pkgName || shortId,
        version: "1.0.0",
        private: true,
        codeLink: {
            shortProjectHash: shortId,
            framerProjectName: projectName,
        },
    }
    await fs.writeFile(path.join(projectDirectory, "package.json"), JSON.stringify(pkg, null, 4))

    return { directory: projectDirectory, created: true, nameCollision }
}

/**
 * Returns a directory path that doesn't collide with an existing project.
 * Tries the bare name first, falls back to name-{shortId} if taken.
 */
async function findAvailableDirectory(
    baseDir: string,
    name: string,
    shortId: string
): Promise<{ directory: string; nameCollision: boolean }> {
    const candidate = path.join(baseDir, name)
    try {
        await fs.access(candidate)
        // Directory exists — it belongs to a different project (findExistingProjectDirectory
        // already checked for a hash match). Disambiguate with the project hash.
        return { directory: path.join(baseDir, `${name}-${shortId}`), nameCollision: true }
    } catch {
        // Doesn't exist yet, use the bare name
        return { directory: candidate, nameCollision: false }
    }
}

async function findExistingProjectDirectory(baseDirectory: string, projectHash: string): Promise<string | null> {
    const candidate = path.join(baseDirectory, "package.json")
    if (await matchesProject(candidate, projectHash)) {
        return baseDirectory
    }

    const entries = await fs.readdir(baseDirectory, { withFileTypes: true })
    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const directory = path.join(baseDirectory, entry.name)
        if (await matchesProject(path.join(directory, "package.json"), projectHash)) {
            return directory
        }
    }

    return null
}

async function matchesProject(packageJsonPath: string, projectHash: string): Promise<boolean> {
    try {
        const pkg = await readAndMigratePackageJson(packageJsonPath)
        if (!pkg) {
            return false
        }
        const inputShort = shortProjectHash(projectHash)
        // Match on short id (handles both full hash input and short id input)
        return getShortProjectHashFromPackage(pkg) === inputShort
    } catch {
        return false
    }
}
