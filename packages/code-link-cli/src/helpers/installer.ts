/**
 * Type installer helper using @typescript/ata
 */

import { setupTypeAcquisition } from "@typescript/ata"
import fs from "fs/promises"
import path from "path"
import ts from "typescript"
import { extractImports } from "../utils/imports.ts"
import { debug, error, warn } from "../utils/logging.ts"
import { installSkills } from "./skills.ts"

export interface InstallerConfig {
    projectDir: string
    allowUnsupportedNpm?: boolean
}

/** npm registry package.json exports field value */
interface NpmExportValue {
    import?: string
    require?: string
    types?: string
}

/** npm registry API response for a single package version */
interface NpmPackageVersion {
    exports?: Record<string, string | NpmExportValue>
}

/** npm registry API response */
interface NpmRegistryResponse {
    "dist-tags"?: { latest?: string }
    versions?: Record<string, NpmPackageVersion>
}

const FETCH_TIMEOUT_MS = 60_000
const MAX_FETCH_RETRIES = 3
const MAX_CONSECUTIVE_FAILURES = 10
const REACT_TYPES_VERSION = "18.3.12"
const REACT_DOM_TYPES_VERSION = "18.3.1"
const CORE_LIBRARIES = ["framer-motion", "framer"]
const JSON_EXTENSION_REGEX = /\.json$/i


/**
 * Packages that are officially supported for type acquisition.
 * Use --unsupported-npm flag to allow other packages.
 */
const SUPPORTED_PACKAGES = new Set([
    "framer",
    "framer-motion",
    "react",
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
    private allowUnsupportedNpm: boolean
    private ata: ReturnType<typeof setupTypeAcquisition>
    private processedImports = new Set<string>()
    private initializationPromise: Promise<void> | null = null

    constructor(config: InstallerConfig) {
        this.projectDir = config.projectDir
        this.allowUnsupportedNpm = config.allowUnsupportedNpm ?? false

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
     * Fire-and-forget processing of a component file to fetch missing types.
     * JSON files are ignored.
     */
    process(fileName: string, content: string): void {
        if (!content || JSON_EXTENSION_REGEX.test(fileName)) {
            return
        }

        Promise.resolve()
            .then(async () => {
                await this.processImports(fileName, content)
            })
            .catch((err: unknown) => {
                debug(`Type installer failed for ${fileName}`, err)
            })
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

        // Fire-and-forget type installation - don't block initialization
        Promise.resolve()
            .then(async () => {
                await this.ensureReact18Types()

                const coreImports = CORE_LIBRARIES.map(lib => `import "${lib}";`).join("\n")
                await this.ata(coreImports)
            })
            .catch((err: unknown) => {
                debug("Type installation failed", err)
            })
    }

    private async processImports(fileName: string, content: string): Promise<void> {
        const allImports = extractImports(content).filter(i => i.type === "npm")

        if (allImports.length === 0) return

        // Filter to supported packages unless --unsupported-npm flag is set
        const imports = this.allowUnsupportedNpm ? allImports : allImports.filter(i => this.isSupportedPackage(i.name))

        const unsupportedCount = allImports.length - imports.length
        if (unsupportedCount > 0 && !this.allowUnsupportedNpm) {
            const unsupported = allImports.filter(i => !this.isSupportedPackage(i.name)).map(i => i.name)
            debug(`Skipping unsupported packages: ${unsupported.join(", ")} (use --unsupported-npm to enable)`)
        }

        if (imports.length === 0) {
            return
        }

        const hash = imports
            .map(imp => imp.name)
            .sort()
            .join(",")

        if (this.processedImports.has(hash)) {
            return
        }

        this.processedImports.add(hash)
        debug(`Processing imports for ${fileName} (${imports.length} packages)`)

        // Build filtered content with only supported imports for ATA
        const filteredContent = this.allowUnsupportedNpm ? content : this.buildFilteredImports(imports)

        try {
            await this.ata(filteredContent)
        } catch (err) {
            warn(`ATA failed for ${fileName}`, err as Error)
        }
    }

    /**
     * Check if a package is in the supported list.
     * Also checks for subpath imports (e.g., "framer/build" -> "framer")
     */
    private isSupportedPackage(pkgName: string): boolean {
        // Direct match
        if (SUPPORTED_PACKAGES.has(pkgName)) {
            return true
        }

        // Check if base package is supported (e.g., "framer-motion/dist" -> "framer-motion")
        const basePkg = pkgName.startsWith("@") ? pkgName.split("/").slice(0, 2).join("/") : pkgName.split("/")[0]

        return SUPPORTED_PACKAGES.has(basePkg)
    }

    /**
     * Build synthetic import statements for ATA from filtered imports
     */
    private buildFilteredImports(imports: { name: string }[]): string {
        return imports.map(imp => `import "${imp.name}";`).join("\n")
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
            const version = npmData["dist-tags"]?.latest
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
            await fs.writeFile(packagePath, JSON.stringify(pkg, null, 2))
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

    // Code components in Framer use React 18
    private async ensureReact18Types(): Promise<void> {
        const reactTypesDir = path.join(this.projectDir, "node_modules/@types/react")

        const reactFiles = ["package.json", "index.d.ts", "global.d.ts", "jsx-runtime.d.ts", "jsx-dev-runtime.d.ts"]

        if (await this.hasTypePackage(reactTypesDir, REACT_TYPES_VERSION, reactFiles)) {
            debug("📦 React types (from cache)")
        } else {
            debug("Downloading React 18 types...")
            await this.downloadTypePackage("@types/react", REACT_TYPES_VERSION, reactTypesDir, reactFiles)
        }

        const reactDomDir = path.join(this.projectDir, "node_modules/@types/react-dom")

        const reactDomFiles = ["package.json", "index.d.ts", "client.d.ts"]

        if (await this.hasTypePackage(reactDomDir, REACT_DOM_TYPES_VERSION, reactDomFiles)) {
            debug("📦 React DOM types (from cache)")
        } else {
            await this.downloadTypePackage("@types/react-dom", REACT_DOM_TYPES_VERSION, reactDomDir, reactDomFiles)
        }
    }

    private async hasTypePackage(destinationDir: string, version: string, files: string[]): Promise<boolean> {
        try {
            const pkgJsonPath = path.join(destinationDir, "package.json")
            const pkgJson = await fs.readFile(pkgJsonPath, "utf-8")
            const parsed = JSON.parse(pkgJson) as { version?: string }

            if (parsed.version !== version) {
                return false
            }

            for (const file of files) {
                if (file === "package.json") continue
                await fs.access(path.join(destinationDir, file))
            }

            return true
        } catch {
            return false
        }
    }

    private async downloadTypePackage(
        pkgName: string,
        version: string,
        destinationDir: string,
        files: string[]
    ): Promise<void> {
        const baseUrl = `https://unpkg.com/${pkgName}@${version}`
        await fs.mkdir(destinationDir, { recursive: true })

        await Promise.all(
            files.map(async file => {
                const destination = path.join(destinationDir, file)

                // Check if file already exists
                try {
                    await fs.access(destination)
                    return // Skip if exists
                } catch {
                    // File doesn't exist, download it
                }

                try {
                    const response = await fetch(`${baseUrl}/${file}`)
                    if (!response.ok) return
                    const content = await response.text()
                    await fs.writeFile(destination, content)
                } catch {
                    // ignore per-file failures
                }
            })
        )
    }
}

// Helpers

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
                warn(`Fetch failed (${error.cause?.code ?? error.message}) for ${urlString}, retrying in ${delay}ms...`)
                await new Promise(resolve => setTimeout(resolve, delay))
                continue
            }

            warn(`Fetch failed for ${urlString}`, error)
            throw error
        }
    }

    throw new Error(`Max retries exceeded for ${urlString}`)
}
