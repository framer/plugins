/**
 * Type installer helper using @typescript/ata
 */

import { setupTypeAcquisition } from "@typescript/ata"
import fs from "fs/promises"
import path from "path"
import { parseImports } from "parse-imports"
import ts from "typescript"
import type { DependencyVersions, FileInfo, NpmStrategy } from "../types.ts"
import { debug, error, status, warn } from "../utils/logging.ts"
import { installSkills } from "./skills.ts"

export interface InstallerConfig {
    projectDir: string
    npmStrategy?: NpmStrategy
    requestDependencyVersions?: (packages: string[]) => Promise<DependencyVersions>
}

/** npm registry package.json exports field value */
interface NpmExportValue {
    import?: string
    require?: string
    types?: string
}

type NpmDependencyMap = Record<string, string | undefined>

/** npm registry API response for a single package version */
interface NpmPackageVersion {
    exports?: Record<string, string | NpmExportValue>
}

interface NpmPackageManifest extends NpmPackageVersion {
    version?: string
    dependencies?: NpmDependencyMap
    peerDependencies?: NpmDependencyMap
}

interface ProjectPackageJson {
    dependencies?: NpmDependencyMap
    devDependencies?: NpmDependencyMap
}

/** npm registry API response */
interface NpmRegistryResponse {
    "dist-tags"?: { latest?: string }
    versions?: Record<string, NpmPackageVersion>
}

const FETCH_TIMEOUT_MS = 60_000
const MAX_FETCH_RETRIES = 3
const MAX_CONSECUTIVE_FAILURES = 10
const FRAMER_PACKAGE_NAME = "framer"
const CORE_LIBRARIES = ["framer-motion", "framer", "react", "react-dom"]
const PACKAGE_MANAGER_DEV_DEPENDENCIES = ["@types/react", "@types/react-dom"]

/** Packages with pinned type versions — used by ATA's `// types:` comment syntax */
const DEFAULT_PINNED_TYPE_VERSIONS: Record<string, string> = {
    "framer-motion": "12.34.3",
    react: "18.2.0",
    "react-dom": "18.2.0",
    "@types/react": "18.2.0",
    "@types/react-dom": "18.2.0",
}

const JSON_EXTENSION_REGEX = /\.json$/i

/**
 * Packages that receive ATA types even when unsupported npm is not enabled.
 */
const DEFAULT_PACKAGES = new Set([
    "framer",
    "framer-motion",
    "react",
    "react-dom",
    "@types/react",
    "eventemitter3",
    "csstype",
    "motion-dom",
    "motion-utils",
])

/**
 * Installer class for managing automatic type acquisition.
 */
export class Installer {
    private projectDir: string
    private npmStrategy: NpmStrategy | undefined
    private requestDependencyVersions: (packages: string[]) => Promise<DependencyVersions>
    private ata: ReturnType<typeof setupTypeAcquisition>
    private processedImports = new Set<string>()
    private packageManagerPackages = new Set<string>()
    private packageJsonUpdatePromise: Promise<void> = Promise.resolve()
    private initializationPromise: Promise<void> | null = null
    private pinnedTypeVersions: Record<string, string> = { ...DEFAULT_PINNED_TYPE_VERSIONS }
    private pinnedTypeVersionsPromise: Promise<void> | null = null

    constructor(config: InstallerConfig) {
        this.projectDir = config.projectDir
        this.npmStrategy = config.npmStrategy
        this.requestDependencyVersions =
            config.requestDependencyVersions ??
            (async packages => Object.fromEntries(packages.map(packageName => [packageName, null])))

        const seenPackages = new Set<string>()

        this.ata = setupTypeAcquisition({
            projectName: "framer-code-link",
            typescript: ts,
            logger: console,
            fetcher: fetchWithRetry,
            delegate: {
                started: () => {
                    seenPackages.clear()
                    debug("ATA: fetching type definitions...")
                },
                progress: () => {
                    // intentionally noop – progress noise is not helpful in CLI output
                },
                finished: files => {
                    if (files.size > 0) {
                        debug("ATA: type acquisition complete")
                    }
                },
                errorMessage: (message: string, error: Error) => {
                    warn(`ATA warning: ${message}`, error)
                },
                receivedFile: (code: string, receivedPath: string) => {
                    void (async () => {
                        const normalized = receivedPath.replace(/^\//, "")
                        const destination = path.join(this.projectDir, normalized)

                        const pkgMatch = /\/node_modules\/(@?[^/]+(?:\/[^/]+)?)\//.exec(receivedPath)

                        // Check if file already exists with same content
                        try {
                            const existing = await fs.readFile(destination, "utf-8")
                            if (existing === code) {
                                if (pkgMatch && !seenPackages.has(pkgMatch[1])) {
                                    seenPackages.add(pkgMatch[1])
                                    debug(`📦 Types: ${pkgMatch[1]} (from disk cache)`)
                                }
                                return // Skip write if identical
                            }
                        } catch {
                            // File doesn't exist or can't be read, proceed with write
                        }

                        if (pkgMatch && !seenPackages.has(pkgMatch[1])) {
                            seenPackages.add(pkgMatch[1])
                            debug(`📦 Types: ${pkgMatch[1]}`)
                        }

                        await this.writeTypeFile(receivedPath, code)
                    })()
                },
            },
        })

        debug("Type installer initialized")
    }

    /**
     * Ensure the project scaffolding exists (tsconfig, declarations, etc.)
     */
    async initialize(): Promise<void> {
        if (this.initializationPromise) {
            return this.initializationPromise
        }

        this.initializationPromise = this.initializeProject()
            .then(() => {
                debug("Type installer initialization complete")
            })
            .catch((err: unknown) => {
                this.initializationPromise = null
                throw err
            })

        return this.initializationPromise
    }

    /**
     * Process component files to fetch missing types or add `package.json` dependencies.
     * JSON files are ignored.
     */
    async processFiles(files: FileInfo[]): Promise<void> {
        const packageNames = new Set<string>()

        for (const file of files) {
            if (!file.content || JSON_EXTENSION_REGEX.test(file.name)) {
                continue
            }

            try {
                const imports = await extractNpmPackageNames(file.content)
                for (const packageName of imports) {
                    packageNames.add(packageName)
                }
            } catch (err: unknown) {
                debug(`Type installer failed to parse imports for ${file.name}`, err)
            }
        }

        await this.processNpmPackages(packageNames, files.length)
    }

    // Internal helpers

    private async initializeProject(): Promise<void> {
        await Promise.all([
            this.ensureTsConfig(),
            this.ensurePrettierConfig(),
            this.ensureFramerDeclarations(),
            this.ensurePackageJson(),
            this.ensureSkills(),
            this.ensureGitignore(),
        ])

        if (this.npmStrategy === "package-manager") {
            await this.resolvePinnedTypeVersions()
            return
        }

        this.pinnedTypeVersionsPromise = this.resolvePinnedTypeVersions()

        // Fire-and-forget type installation - don't block initialization
        Promise.resolve()
            .then(async () => {
                const coreImports = await this.buildPinnedImports(CORE_LIBRARIES)

                // After pins are resolved, also include package.json deps
                const packageJsonDeps =
                    this.npmStrategy === "acquire-types"
                        ? Object.keys(this.pinnedTypeVersions).filter(name => !DEFAULT_PACKAGES.has(name))
                        : []

                const imports = [...coreImports, ...(await this.buildPinnedImports(packageJsonDeps))].join("\n")
                await this.ata(imports)
            })
            .catch((err: unknown) => {
                debug("Type installation failed", err)
            })
    }

    private async processNpmPackages(packageNames: Set<string>, fileCount: number): Promise<void> {
        const allPackageNames = [...packageNames]

        // package-manager: just keep package.json dependencies current.
        if (this.npmStrategy === "package-manager") {
            for (const packageName of [...CORE_LIBRARIES, ...PACKAGE_MANAGER_DEV_DEPENDENCIES]) {
                allPackageNames.push(packageName)
            }

            await this.queuePackageJsonUpdate(allPackageNames)
            return
        }

        if (allPackageNames.length === 0) return

        let packagesForAta: string[]
        if (this.npmStrategy === "acquire-types") {
            // acquire-types: unsupported npm is explicitly enabled, so every npm import gets ATA.
            packagesForAta = allPackageNames
        } else {
            // default: npm imports are not supported, but default packages still need types via ATA.
            packagesForAta = allPackageNames.filter(packageName => this.isDefaultPackage(packageName))
            const unsupportedPackages = allPackageNames.filter(packageName => !this.isDefaultPackage(packageName))
            if (unsupportedPackages.length > 0) {
                debug(`Skipping unsupported packages: ${unsupportedPackages.join(", ")} (use --unsupported-npm to enable)`)
            }
        }

        if (packagesForAta.length === 0) {
            return
        }

        await this.pinnedTypeVersionsPromise

        if (this.npmStrategy === "acquire-types") {
            await this.resolvePackageJsonPins()
        }

        const hash = packagesForAta
            .map(packageName => this.pinImport(packageName))
            .sort()
            .join(",")

        if (this.processedImports.has(hash)) {
            return
        }

        this.processedImports.add(hash)
        debug(
            `Processing imports from ${fileCount} ${fileCount === 1 ? "file" : "files"} (${packagesForAta.length} packages)`
        )

        try {
            await this.ata((await this.buildPinnedImports(packagesForAta)).join("\n"))
        } catch (err) {
            warn("Type fetching failed")
            debug("ATA error:", err)
        }
    }

    private async queuePackageJsonUpdate(packageNames: string[]): Promise<void> {
        const missingPackageNames = packageNames.filter(packageName => {
            if (this.packageManagerPackages.has(packageName)) {
                return false
            }

            this.packageManagerPackages.add(packageName)
            return true
        })

        if (missingPackageNames.length === 0) {
            return this.packageJsonUpdatePromise
        }

        this.packageJsonUpdatePromise = this.packageJsonUpdatePromise
            .then(async () => {
                await this.updatePackageJsonFromPlugin(missingPackageNames)
            })
            .catch((err: unknown) => {
                warn("Could not refresh package.json dependency versions", err)
            })

        return this.packageJsonUpdatePromise
    }

    private async updatePackageJsonFromPlugin(packageNames: string[]): Promise<void> {
        const uniquePackageNames = [...new Set(packageNames)].sort()
        const versions = await this.requestDependencyVersions(uniquePackageNames)
        const packagePath = path.join(this.projectDir, "package.json")

        const raw = await fs.readFile(packagePath, "utf-8")
        const pkg = JSON.parse(raw) as ProjectPackageJson
        const dependencies =
            typeof pkg.dependencies === "object" && pkg.dependencies !== null && !Array.isArray(pkg.dependencies)
                ? { ...pkg.dependencies }
                : {}
        const devDependencies =
            typeof pkg.devDependencies === "object" &&
            pkg.devDependencies !== null &&
            !Array.isArray(pkg.devDependencies)
                ? { ...pkg.devDependencies }
                : {}

        let changed = false
        for (const packageName of uniquePackageNames) {
            const version = versions[packageName] ?? this.pinnedTypeVersions[packageName]
            if (!version) {
                continue
            }

            const targetDependencies = PACKAGE_MANAGER_DEV_DEPENDENCIES.includes(packageName)
                ? devDependencies
                : dependencies
            const oppositeDependencies = PACKAGE_MANAGER_DEV_DEPENDENCIES.includes(packageName)
                ? dependencies
                : devDependencies

            if (targetDependencies[packageName] !== version) {
                targetDependencies[packageName] = version
                changed = true
            }

            if (oppositeDependencies[packageName] !== undefined) {
                delete oppositeDependencies[packageName]
                changed = true
            }
        }

        if (!changed) {
            return
        }

        pkg.dependencies = sortDependencyMap(dependencies)
        pkg.devDependencies = sortDependencyMap(devDependencies)
        await fs.writeFile(packagePath, JSON.stringify(pkg, null, 4))
        status("Updated dependencies. Run your package manager to install them.")
        debug(`Updated package.json dependency versions for ${uniquePackageNames.join(", ")}`)
    }

    /**
     * Check if a package receives ATA types without unsupported npm enabled.
     */
    private isDefaultPackage(pkgName: string): boolean {
        if (DEFAULT_PACKAGES.has(pkgName)) {
            return true
        }

        const basePkg = getBasePackageName(pkgName)

        return DEFAULT_PACKAGES.has(basePkg)
    }

    private async buildPinnedImports(imports: string[]): Promise<string[]> {
        await this.pinnedTypeVersionsPromise
        return imports.map(name => this.pinImport(name))
    }

    private async resolvePinnedTypeVersions(): Promise<void> {
        try {
            const framerManifest = await fetchNpmPackageManifest(FRAMER_PACKAGE_NAME)
            const framerVersion = normalizePinnedVersion(framerManifest.version)
            if (framerVersion) {
                this.pinnedTypeVersions.framer = framerVersion
            }

            for (const [pkg, defaultVersion] of Object.entries(DEFAULT_PINNED_TYPE_VERSIONS)) {
                const manifestDep = pkg.replace(/^@types\//, "")
                this.pinnedTypeVersions[pkg] =
                    normalizePinnedVersion(getManifestDependencyVersion(framerManifest, manifestDep)) ?? defaultVersion
            }

            debug(
                `Resolved ATA pins from ${FRAMER_PACKAGE_NAME}@${framerVersion ?? "latest"} ` +
                    `(framer-motion ${this.pinnedTypeVersions["framer-motion"]}, react ${this.pinnedTypeVersions.react})`
            )
        } catch (err) {
            debug(`Falling back to default ATA pins for ${FRAMER_PACKAGE_NAME}`, err)
        }

        if (this.npmStrategy === "acquire-types") {
            await this.resolvePackageJsonPins()
        }
    }

    private async resolvePackageJsonPins(): Promise<void> {
        try {
            const pkgPath = path.join(this.projectDir, "package.json")
            const raw = await fs.readFile(pkgPath, "utf-8")
            const parsed: unknown = JSON.parse(raw)
            const pkg = parsed as ProjectPackageJson
            const allDeps: NpmDependencyMap = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
            for (const [name, range] of Object.entries(allDeps)) {
                const version = normalizePinnedVersion(range)
                if (version) {
                    this.pinnedTypeVersions[name] = version
                }
            }
            debug(`Resolved ${Object.keys(allDeps).length} package.json version pins`)
        } catch {
            warn("Could not read package.json for version pinning")
        }
    }

    /**
     * Build an import statement with an optional `// types:` version pin for ATA.
     * Resolves the base package name for subpath imports (e.g., "framer-motion/dist" -> "framer-motion").
     */
    private pinImport(name: string): string {
        const base = getBasePackageName(name)
        const version = this.pinnedTypeVersions[base]
        if (version) return `import "${name}"; // types: ${version}`
        return `import "${name}";`
    }

    private async writeTypeFile(receivedPath: string, code: string): Promise<void> {
        const normalized = receivedPath.replace(/^\//, "")
        const destination = path.join(this.projectDir, normalized)

        try {
            await fs.mkdir(path.dirname(destination), { recursive: true })
            await fs.writeFile(destination, code, "utf-8")
        } catch (err) {
            warn(`Failed to write type file ${destination}`, err)
            return
        }

        if (/node_modules\/@types\/[^/]+\/index\.d\.ts$/.exec(normalized)) {
            await this.ensureTypesPackageJson(normalized)
        }
    }

    private async ensureTypesPackageJson(normalizedPath: string): Promise<void> {
        const pkgMatch = /node_modules\/(@types\/[^/]+)\//.exec(normalizedPath)
        if (!pkgMatch) return

        const pkgName = pkgMatch[1]
        const pkgDir = path.join(this.projectDir, "node_modules", pkgName)
        const pkgJsonPath = path.join(pkgDir, "package.json")

        try {
            const response = await fetch(`https://registry.npmjs.org/${pkgName}`)
            if (!response.ok) return

            const npmData = (await response.json()) as NpmRegistryResponse

            // Use pinned version if available, otherwise fall back to latest
            const pinnedVersion = this.pinnedTypeVersions[pkgName]
            const version = pinnedVersion
                ? this.findMatchingVersion(Object.keys(npmData.versions ?? {}), pinnedVersion)
                : npmData["dist-tags"]?.latest
            if (!version || !npmData.versions?.[version]) return

            const pkg = npmData.versions[version]
            if (pkg.exports) {
                for (const key of Object.keys(pkg.exports)) {
                    pkg.exports[key] = fixExportTypes(pkg.exports[key])
                }
            }

            await fs.mkdir(pkgDir, { recursive: true })
            await fs.writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2))
        } catch {
            // best-effort
        }
    }

    /**
     * Find the best matching version from a list of available versions.
     * Supports exact versions ("18.2.0") — returns exact match if available.
     */
    private findMatchingVersion(versions: string[], pinned: string): string | undefined {
        // Exact match
        if (versions.includes(pinned)) return pinned

        // For exact pins that don't match, find the closest version with matching major.minor
        const [major, minor] = pinned.split(".")
        const prefix = `${major}.${minor}.`
        const matching = versions.filter(v => v.startsWith(prefix))
        return matching.length > 0 ? matching[matching.length - 1] : undefined
    }

    private async ensureTsConfig(): Promise<void> {
        const tsconfigPath = path.join(this.projectDir, "tsconfig.json")
        try {
            await fs.access(tsconfigPath)
            debug("tsconfig.json already exists")
        } catch {
            const config = {
                compilerOptions: {
                    noEmit: true,
                    target: "ES2021",
                    lib: ["ES2021", "DOM", "DOM.Iterable"],
                    module: "ESNext",
                    moduleResolution: "bundler",
                    customConditions: ["source"],
                    jsx: "react-jsx",
                    allowJs: true,
                    allowSyntheticDefaultImports: true,
                    strict: false,
                    allowImportingTsExtensions: true,
                    resolveJsonModule: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    typeRoots: ["./node_modules/@types"],
                },
                include: ["files/**/*", "framer-modules.d.ts"],
            }
            await fs.writeFile(tsconfigPath, JSON.stringify(config, null, 2))
            debug("Created tsconfig.json")
        }
    }

    private async ensurePrettierConfig(): Promise<void> {
        const prettierPath = path.join(this.projectDir, ".prettierrc")
        try {
            await fs.access(prettierPath)
            debug(".prettierrc already exists")
        } catch {
            const config = {
                tabWidth: 4,
                semi: false,
                trailingComma: "es5",
            }
            await fs.writeFile(prettierPath, JSON.stringify(config, null, 2))
            debug("Created .prettierrc")
        }
    }

    private async ensureFramerDeclarations(): Promise<void> {
        const declarationsPath = path.join(this.projectDir, "framer-modules.d.ts")
        try {
            await fs.access(declarationsPath)
            debug("framer-modules.d.ts already exists")
        } catch {
            const declarations = `// Type declarations for Framer URL imports
declare module "https://framer.com/m/*"

declare module "https://framerusercontent.com/*"

declare module "*.json"
`
            await fs.writeFile(declarationsPath, declarations)
            debug("Created framer-modules.d.ts")
        }
    }

    private async ensurePackageJson(): Promise<void> {
        const packagePath = path.join(this.projectDir, "package.json")
        try {
            await fs.access(packagePath)
            debug("package.json already exists")
        } catch {
            const pkg = {
                name: path.basename(this.projectDir),
                version: "1.0.0",
                private: true,
                description: "Framer files synced with framer-code-link",
            }
            await fs.writeFile(packagePath, JSON.stringify(pkg, null, 4))
            debug("Created package.json")
        }
    }

    private async ensureSkills(): Promise<void> {
        await installSkills(this.projectDir)
    }

    private async ensureGitignore(): Promise<void> {
        const gitignorePath = path.join(this.projectDir, ".gitignore")

        try {
            await fs.access(gitignorePath)
            debug(".gitignore already exists")
            return
        } catch {
            // Doesn't exist, create it
        }

        const content = [
            "node_modules/",
            ".DS_Store",
            "*.local",
            "",
            "# Framer Code Link",
            ".framer-sync-state.json",
            ".skills/",
            ".agents/skills/",
            ".claude/skills/",
            ".cursor/skills/",
            "",
        ].join("\n")

        await fs.writeFile(gitignorePath, content)
        debug("Created .gitignore")
    }
}

function getManifestDependencyVersion(manifest: NpmPackageManifest, packageName: string): string | undefined {
    return manifest.peerDependencies?.[packageName] ?? manifest.dependencies?.[packageName]
}

function getBasePackageName(packageName: string): string {
    const parts = packageName.split("/")
    if (packageName.startsWith("@")) {
        return parts.length >= 2 ? parts.slice(0, 2).join("/") : packageName
    }

    return parts[0] ?? packageName
}

async function extractNpmPackageNames(code: string): Promise<string[]> {
    const imports = await parseImports(code)
    const seen = new Set<string>()

    for (const imported of imports) {
        const specifier = imported.moduleSpecifier
        if (specifier.type !== "package" || !specifier.isConstant || !specifier.value) {
            continue
        }

        seen.add(getBasePackageName(specifier.value))
    }

    return [...seen]
}

function sortDependencyMap(dependencies: NpmDependencyMap): NpmDependencyMap {
    return Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)))
}

function normalizePinnedVersion(version: string | undefined): string | undefined {
    if (!version) return undefined
    const match = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/.exec(version)
    return match?.[0]
}

async function fetchNpmPackageManifest(packageName: string): Promise<NpmPackageManifest> {
    const response = await fetchWithRetry(`https://registry.npmjs.org/${packageName}/latest`)

    if (!response.ok) {
        throw new Error(`Failed to fetch ${packageName} manifest: ${response.status}`)
    }

    return (await response.json()) as NpmPackageManifest
}

/**
 * Transform package.json exports to include .d.ts type paths
 */
function fixExportTypes(value: string | NpmExportValue): string | NpmExportValue {
    if (typeof value === "string") {
        return {
            types: value.replace(/\.js$/, ".d.ts").replace(/\.cjs$/, ".d.cts"),
        }
    }

    if ((value.import ?? value.require) && !value.types) {
        const base = value.import ?? value.require
        value.types = base?.replace(/\.js$/, ".d.ts").replace(/\.cjs$/, ".d.cts")
    }

    return value
}

interface FetchError extends Error {
    cause?: { code?: string }
}

/** Tracks consecutive network failures across all fetches */
let consecutiveFailures = 0

/** Reset failure counter on successful fetch */
function resetFailureCounter(): void {
    consecutiveFailures = 0
}

/** Check if we should give up due to persistent network issues */
function checkFatalFailure(url: string): void {
    consecutiveFailures++
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        error(
            `Network unavailable - ${MAX_CONSECUTIVE_FAILURES} fetch failures.\n` +
                `  Check your internet connection and try again.\n` +
                `  Last failed URL: ${url}`
        )
        process.exit(1)
    }
}

// ATA occasionally has some issues with larger packages e.g. framer-motion
// We use a custom fetch handler to allow us to keep trying
async function fetchWithRetry(
    url: string | URL | Request,
    init?: RequestInit,
    retries = MAX_FETCH_RETRIES
): Promise<Response> {
    let urlString: string
    if (typeof url === "string") {
        urlString = url
    } else if (url instanceof URL) {
        urlString = url.href
    } else {
        urlString = url.url
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController()
        const timeout = setTimeout(() => {
            controller.abort()
        }, FETCH_TIMEOUT_MS)

        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
            })
            clearTimeout(timeout)
            resetFailureCounter()
            return response
        } catch (err: unknown) {
            clearTimeout(timeout)
            const error = err as FetchError

            const isRetryable =
                error.cause?.code === "ECONNRESET" ||
                error.cause?.code === "ETIMEDOUT" ||
                error.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
                error.message.includes("timeout")

            // Count every timeout, not just final failures - exits if too many across all fetches
            if (isRetryable) {
                checkFatalFailure(urlString)
            }

            if (attempt < retries && isRetryable) {
                const delay = attempt * 1_000
                debug(`Fetch failed for ${urlString}, retrying...`, error)
                await new Promise(resolve => setTimeout(resolve, delay))
                continue
            }

            warn(`Fetch failed for ${urlString}`)
            debug(`Fetch error details:`, error)
            throw error
        }
    }

    throw new Error(`Max retries exceeded for ${urlString}`)
}
