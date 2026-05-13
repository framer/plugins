import path from "path"
import type { Config, NpmStrategy } from "../types.ts"
import { debug, warn } from "../utils/logging.ts"
import { readAndMigratePackageJson } from "../utils/project.ts"

const CONFIG_FIELD = "codeLink.npmStrategy"

export async function resolveNpmStrategy(config: Config, projectDir: string): Promise<NpmStrategy | undefined> {
    if (config.npmStrategy) {
        debug(`Using npm strategy from CLI flag: ${config.npmStrategy}`)
        return config.npmStrategy
    }

    const packageJsonStrategy = await readPackageJsonStrategy(projectDir)
    if (packageJsonStrategy) {
        debug(`Using npm strategy from package.json ${CONFIG_FIELD}: ${packageJsonStrategy}`)
        return packageJsonStrategy
    }

    debug("No npm strategy from CLI or package.json")
    return undefined
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

function isNpmStrategy(value: unknown): value is NpmStrategy {
    return value === "acquire-types" || value === "package-manager"
}
