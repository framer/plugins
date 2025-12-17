/**
 * Type installer helper using @typescript/ata
 */

import { setupTypeAcquisition } from "@typescript/ata"
import ts from "typescript"
import path from "path"
import fs from "fs/promises"
import { extractImports } from "../utils/imports.js"
import { debug, warn } from "../utils/logging.js"

export interface InstallerConfig {
  projectDir: string
  allowUnsupportedNpm?: boolean
}

const FETCH_TIMEOUT_MS = 60_000
const MAX_FETCH_RETRIES = 3
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
        finished: (files) => {
          if (files && files.size > 0) {
            debug("ATA: type acquisition complete")
          }
        },
        errorMessage: (message: string, error: Error) => {
          warn(`ATA warning: ${message}`, error)
        },
        receivedFile: async (code: string, receivedPath: string) => {
          const normalized = receivedPath.replace(/^\//, "")
          const destination = path.join(this.projectDir, normalized)

          const pkgMatch = receivedPath.match(
            /\/node_modules\/(@?[^\/]+(?:\/[^\/]+)?)\//
          )

          // Check if file already exists with same content
          let isFromCache = false
          try {
            const existing = await fs.readFile(destination, "utf-8")
            if (existing === code) {
              isFromCache = true
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
      .catch((err) => {
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
      .catch((err) => {
        debug(`Type installer failed for ${fileName}`, err)
      })
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async initializeProject(): Promise<void> {
    await Promise.all([
      this.ensureTsConfig(),
      this.ensurePrettierConfig(),
      this.ensureFramerDeclarations(),
      this.ensurePackageJson(),
    ])

    // Fire-and-forget type installation - don't block initialization
    Promise.resolve()
      .then(async () => {
        await this.ensureReact18Types()

        const coreImports = CORE_LIBRARIES.map(
          (lib) => `import "${lib}";`
        ).join("\n")
        await this.ata(coreImports)
      })
      .catch((err) => {
        debug("Type installation failed", err)
      })
  }

  private async processImports(
    fileName: string,
    content: string
  ): Promise<void> {
    const allImports = extractImports(content).filter((i) => i.type === "npm")

    if (allImports.length === 0) return

    // Filter to supported packages unless --unsupported-npm flag is set
    const imports = this.allowUnsupportedNpm
      ? allImports
      : allImports.filter((i) => this.isSupportedPackage(i.name))

    const unsupportedCount = allImports.length - imports.length
    if (unsupportedCount > 0 && !this.allowUnsupportedNpm) {
      const unsupported = allImports
        .filter((i) => !this.isSupportedPackage(i.name))
        .map((i) => i.name)
      debug(
        `Skipping unsupported packages: ${unsupported.join(", ")} (use --unsupported-npm to enable)`
      )
    }

    if (imports.length === 0) {
      return
    }

    const hash = imports
      .map((imp) => imp.name)
      .sort()
      .join(",")

    if (this.processedImports.has(hash)) {
      return
    }

    this.processedImports.add(hash)
    debug(`Processing imports for ${fileName} (${imports.length} packages)`)

    // Build filtered content with only supported imports for ATA
    const filteredContent = this.allowUnsupportedNpm
      ? content
      : this.buildFilteredImports(imports)

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
    const basePkg = pkgName.startsWith("@")
      ? pkgName.split("/").slice(0, 2).join("/")
      : pkgName.split("/")[0]

    return SUPPORTED_PACKAGES.has(basePkg)
  }

  /**
   * Build synthetic import statements for ATA from filtered imports
   */
  private buildFilteredImports(imports: { name: string }[]): string {
    return imports.map((imp) => `import "${imp.name}";`).join("\n")
  }

  private async writeTypeFile(
    receivedPath: string,
    code: string
  ): Promise<void> {
    const normalized = receivedPath.replace(/^\//, "")
    const destination = path.join(this.projectDir, normalized)

    try {
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.writeFile(destination, code, "utf-8")
    } catch (err) {
      warn(`Failed to write type file ${destination}`, err)
      return
    }

    if (normalized.match(/node_modules\/@types\/[^\/]+\/index\.d\.ts$/)) {
      await this.ensureTypesPackageJson(normalized)
    }

    if (normalized.includes("node_modules/@types/react/index.d.ts")) {
      await this.patchReactTypes(destination)
    }
  }

  private async ensureTypesPackageJson(normalizedPath: string): Promise<void> {
    const pkgMatch = normalizedPath.match(/node_modules\/(@types\/[^\/]+)\//)
    if (!pkgMatch) return

    const pkgName = pkgMatch[1]
    const pkgDir = path.join(this.projectDir, "node_modules", pkgName)
    const pkgJsonPath = path.join(pkgDir, "package.json")

    try {
      const response = await fetch(`https://registry.npmjs.org/${pkgName}`)
      if (!response.ok) return

      const npmData = await response.json()
      const version = npmData["dist-tags"]?.latest
      if (!version || !npmData.versions?.[version]) return

      const pkg = npmData.versions[version]

      if (pkg.exports && typeof pkg.exports === "object") {
        const fixExport = (value: any): any => {
          if (typeof value === "string") {
            const tsPath = value
              .replace(/\.js$/, ".d.ts")
              .replace(/\.cjs$/, ".d.cts")
            return { types: tsPath }
          }

          if (value && typeof value === "object") {
            if ((value.import || value.require) && !value.types) {
              const base = value.import || value.require
              value.types = base
                .replace(/\.js$/, ".d.ts")
                .replace(/\.cjs$/, ".d.cts")
            }
          }

          return value
        }

        for (const key of Object.keys(pkg.exports)) {
          pkg.exports[key] = fixExport(pkg.exports[key])
        }
      }

      await fs.mkdir(pkgDir, { recursive: true })
      await fs.writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2))
    } catch {
      // best-effort
    }
  }

  private async patchReactTypes(destination: string): Promise<void> {
    try {
      let content = await fs.readFile(destination, "utf-8")
      if (content.includes("function useRef<T = undefined>()")) {
        return
      }

      const overloadPattern =
        /function useRef<T>\(initialValue: T \| undefined\): RefObject<T \| undefined>;/

      if (!overloadPattern.test(content)) {
        return
      }

      content = content.replace(
        overloadPattern,
        `function useRef<T>(initialValue: T | undefined): RefObject<T | undefined>;
    function useRef<T = undefined>(): MutableRefObject<T | undefined>;`
      )

      await fs.writeFile(destination, content, "utf-8")
    } catch {
      // ignore patch failures
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

  private async ensureReact18Types(): Promise<void> {
    const reactTypesDir = path.join(
      this.projectDir,
      "node_modules/@types/react"
    )

    const reactFiles = [
      "package.json",
      "index.d.ts",
      "global.d.ts",
      "jsx-runtime.d.ts",
      "jsx-dev-runtime.d.ts",
    ]

    if (
      await this.hasTypePackage(reactTypesDir, REACT_TYPES_VERSION, reactFiles)
    ) {
      debug("📦 React types (from cache)")
    } else {
      debug("Downloading React 18 types...")
      await this.downloadTypePackage(
        "@types/react",
        REACT_TYPES_VERSION,
        reactTypesDir,
        reactFiles
      )
    }

    const reactDomDir = path.join(
      this.projectDir,
      "node_modules/@types/react-dom"
    )

    const reactDomFiles = ["package.json", "index.d.ts", "client.d.ts"]

    if (
      await this.hasTypePackage(
        reactDomDir,
        REACT_DOM_TYPES_VERSION,
        reactDomFiles
      )
    ) {
      debug("📦 React DOM types (from cache)")
    } else {
      await this.downloadTypePackage(
        "@types/react-dom",
        REACT_DOM_TYPES_VERSION,
        reactDomDir,
        reactDomFiles
      )
    }
  }

  private async hasTypePackage(
    destinationDir: string,
    version: string,
    files: string[]
  ): Promise<boolean> {
    try {
      const pkgJsonPath = path.join(destinationDir, "package.json")
      const pkgJson = await fs.readFile(pkgJsonPath, "utf-8")
      const parsed = JSON.parse(pkgJson)

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
      files.map(async (file) => {
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

// -----------------------------------------------------------------------------
// Fetch helpers
// -----------------------------------------------------------------------------

async function fetchWithRetry(
  url: string | URL | Request,
  init?: RequestInit,
  retries = MAX_FETCH_RETRIES
): Promise<Response> {
  const urlString = typeof url === "string" ? url : url.toString()

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return response
    } catch (error: any) {
      clearTimeout(timeout)

      const isRetryable =
        error?.cause?.code === "ECONNRESET" ||
        error?.cause?.code === "ETIMEDOUT" ||
        error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
        error?.message?.includes("timeout")

      if (attempt < retries && isRetryable) {
        const delay = attempt * 1_000
        warn(
          `Fetch failed (${error?.cause?.code || error?.message}) for ${urlString}, retrying in ${delay}ms...`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      warn(`Fetch failed for ${urlString}`, error)
      throw error
    }
  }

  throw new Error(`Max retries exceeded for ${urlString}`)
}
