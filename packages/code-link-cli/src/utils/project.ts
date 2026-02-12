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

export async function findOrCreateProjectDirectory(
    projectHash: string,
    projectName?: string,
    explicitDirectory?: string
): Promise<{ directory: string; created: boolean }> {
    if (explicitDirectory) {
        const resolved = path.resolve(explicitDirectory)
        await fs.mkdir(path.join(resolved, "files"), { recursive: true })
        return { directory: resolved, created: false }
    }

    const cwd = process.cwd()
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
    const projectDirectory = path.join(cwd, directoryName || shortId)

    await fs.mkdir(path.join(projectDirectory, "files"), { recursive: true })
    const pkg: PackageJson = {
        name: pkgName || shortId,
        version: "1.0.0",
        private: true,
        shortProjectHash: shortId,
        framerProjectName: projectName,
    }
    await fs.writeFile(path.join(projectDirectory, "package.json"), JSON.stringify(pkg, null, 2))

    return { directory: projectDirectory, created: true }
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
