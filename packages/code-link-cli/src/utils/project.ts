import { shortProjectHash } from "@code-link/shared"
import fs from "fs/promises"
import path from "path"

interface PackageJson {
    shortProjectHash?: string // derived short id (8 chars base58)
    framerProjectName?: string
    name?: string
    version?: string
    [key: string]: unknown
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
        .replace(/[^a-zA-Z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-+/g, "-")
}

export async function getProjectHashFromCwd(): Promise<string | null> {
    try {
        const packageJsonPath = path.join(process.cwd(), "package.json")
        const content = await fs.readFile(packageJsonPath, "utf-8")
        const pkg = JSON.parse(content) as PackageJson
        return pkg.shortProjectHash ?? null
    } catch {
        return null
    }
}

export async function findOrCreateProjectDirectory(options: {
    projectHash: string
    projectName?: string
    explicitDirectory?: string
    baseDirectory?: string
}): Promise<{ directory: string; created: boolean; nameCollision?: boolean }> {
    const { projectHash, projectName, explicitDirectory, baseDirectory } = options

    if (explicitDirectory) {
        const resolved = path.resolve(explicitDirectory)
        await fs.mkdir(path.join(resolved, "files"), { recursive: true })
        return { directory: resolved, created: false }
    }

    const cwd = baseDirectory ?? process.cwd()
    const existing = await findExistingProjectDirectory(cwd, projectHash)
    if (existing) {
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
        shortProjectHash: shortId,
        framerProjectName: projectName,
    }
    await fs.writeFile(path.join(projectDirectory, "package.json"), JSON.stringify(pkg, null, 2))

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
        const content = await fs.readFile(packageJsonPath, "utf-8")
        const pkg = JSON.parse(content) as PackageJson
        const inputShort = shortProjectHash(projectHash)
        // Match on short id (handles both full hash input and short id input)
        return pkg.shortProjectHash === inputShort
    } catch {
        return false
    }
}
