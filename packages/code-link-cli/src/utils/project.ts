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

export function toDirName(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9- ]/g, "-")
        .replace(/^[-\s]+|[-\s]+$/g, "")
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

export async function findOrCreateProjectDir(
    projectHash: string,
    projectName?: string,
    explicitDir?: string
): Promise<string> {
    if (explicitDir) {
        const resolved = path.resolve(explicitDir)
        await fs.mkdir(path.join(resolved, "files"), { recursive: true })
        return resolved
    }

    const cwd = process.cwd()
    const existing = await findExistingProjectDir(cwd, projectHash)
    if (existing) {
        return existing
    }

    if (!projectName) {
        throw new Error("Failed to get Project name. Pass --name <project name>.")
    }

    const dirName = toDirName(projectName)
    const pkgName = toPackageName(projectName)
    const shortId = shortProjectHash(projectHash)
    const projectDir = path.join(cwd, dirName || shortId)

    await fs.mkdir(path.join(projectDir, "files"), { recursive: true })
    const pkg: PackageJson = {
        name: pkgName || shortId,
        version: "1.0.0",
        private: true,
        shortProjectHash: shortId,
        framerProjectName: projectName,
    }
    await fs.writeFile(path.join(projectDir, "package.json"), JSON.stringify(pkg, null, 2))

    return projectDir
}

async function findExistingProjectDir(baseDir: string, projectHash: string): Promise<string | null> {
    const candidate = path.join(baseDir, "package.json")
    if (await matchesProject(candidate, projectHash)) {
        return baseDir
    }

    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const dir = path.join(baseDir, entry.name)
        if (await matchesProject(path.join(dir, "package.json"), projectHash)) {
            return dir
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
