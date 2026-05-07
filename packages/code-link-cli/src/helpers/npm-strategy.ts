import fs from "fs/promises"
import path from "path"
import type { Config, NpmStrategy } from "../types.ts"
import { debug, warn } from "../utils/logging.ts"
import { readAndMigratePackageJson } from "../utils/project.ts"

const CONFIG_FIELD = "codeLink.npmStrategy"
const LOCKFILES = ["yarn.lock", "pnpm-lock.yaml", "package-lock.json", "bun.lockb"]

export async function resolveNpmStrategy(config: Config, projectDir: string): Promise<NpmStrategy> {
    if (config.npmStrategy) {
        debug(`Using npm strategy from CLI flag: ${config.npmStrategy}`)
        return config.npmStrategy
    }

    const packageJsonStrategy = await readPackageJsonStrategy(projectDir)
    if (packageJsonStrategy) {
        debug(`Using npm strategy from package.json ${CONFIG_FIELD}: ${packageJsonStrategy}`)
        return packageJsonStrategy
    }

    const detectedLockfile = await detectLockfile(projectDir)
    if (detectedLockfile) {
        debug(`Using npm strategy package-manager from ${detectedLockfile}`)
        return "package-manager"
    }

    debug("Using default npm strategy: none")
    return "none"
}

async function readPackageJsonStrategy(projectDir: string): Promise<NpmStrategy | null> {
    try {
        const parsed = await readAndMigratePackageJson(path.join(projectDir, "package.json"))
        if (!parsed) {
            return null
        }
        const strategy = parsed.codeLink?.npmStrategy

        if (strategy === undefined) {
            return null
        }

        if (isNpmStrategy(strategy)) {
            return strategy
        }

        warn(`Ignoring invalid package.json ${CONFIG_FIELD}: ${String(strategy)}`)
        return null
    } catch {
        return null
    }
}

async function detectLockfile(projectDir: string): Promise<string | null> {
    for (const fileName of LOCKFILES) {
        try {
            await fs.access(path.join(projectDir, fileName))
            return fileName
        } catch {
            // Check the next lockfile.
        }
    }

    return null
}

function isNpmStrategy(value: unknown): value is NpmStrategy {
    return value === "none" || value === "acquire-types" || value === "package-manager"
}
