#!/usr/bin/env node

/**
 * Framer Code Link CLI - Next Generation
 *
 * Entry point for the CLI tool. Parses command-line arguments and starts
 * the controller with the appropriate configuration.
 */

import { createRequire } from "node:module"
import { getPortFromHash } from "@code-link/shared"
import { Command } from "commander"
import { start } from "./controller.js"
import type { Config } from "./types.js"
import { banner, LogLevel, setLogLevel, warn } from "./utils/logging.js"
import { getProjectHashFromCwd } from "./utils/project.js"

const require = createRequire(import.meta.url)
const { version } = require("../package.json") as { version: string }

const program = new Command()

program.exitOverride(err => {
    if (err.code === "commander.missingArgument") {
        console.error("Missing Project ID. Copy command via Code Link Plugin.")
        process.exit(err.exitCode)
    }
    throw err
})

program
    .name("framer-code-link")
    .description("Sync Framer code components to your local filesystem")
    .version(version)
    .argument("[projectHash]", "Framer Project ID Hash (auto-detected from package.json if omitted)")
    .option("-n, --name <name>", "Project name (optional)")
    .option("-d, --dir <directory>", "Explicit project directory")
    .option("-v, --verbose", "Enable verbose logging")
    .option("--log-level <level>", "Set log level (debug, info, warn, error)")
    .option("--dangerously-auto-delete", "Automatically delete remote files without confirmation")
    .option("--unsupported-npm", "Allow type acquisition for unsupported npm packages")
    .action(
        async (
            projectHash: string | undefined,
            options: {
                name?: string
                dir?: string
                verbose?: boolean
                logLevel?: string
                dangerouslyAutoDelete?: boolean
                unsupportedNpm?: boolean
            }
        ) => {
            // If no projectHash provided, try to read from cwd's package.json
            if (!projectHash) {
                const detected = await getProjectHashFromCwd()
                if (detected) {
                    projectHash = detected
                } else {
                    console.error("No project ID provided and no existing code-link directory found.")
                    console.error("Copy the command from the Code Link Plugin to get started.")
                    process.exit(1)
                }
            }

            if (options.logLevel) {
                const levelMap: Record<string, LogLevel> = {
                    debug: LogLevel.DEBUG,
                    info: LogLevel.INFO,
                    warn: LogLevel.WARN,
                    error: LogLevel.ERROR,
                }
                const level = levelMap[options.logLevel.toLowerCase()] as LogLevel | undefined
                if (level !== undefined) {
                    setLogLevel(level)
                }
            } else if (options.verbose) {
                setLogLevel(LogLevel.DEBUG)
            }

            const port = getPortFromHash(projectHash)

            // Show startup banner
            banner(version, port)

            const config: Config = {
                port,
                projectHash,
                projectDir: null, // Will be set during handshake
                filesDir: null, // Will be set during handshake
                dangerouslyAutoDelete: options.dangerouslyAutoDelete ?? false,
                allowUnsupportedNpm: options.unsupportedNpm ?? false,
                explicitDir: options.dir,
                explicitName: options.name,
            }

            if (config.dangerouslyAutoDelete) {
                warn("Auto-delete mode enabled - files will be deleted without confirmation")
            }

            try {
                await start(config)
            } catch (err) {
                // Error already logged, exit cleanly
                process.exit(1)
            }
        }
    )

program.parse()

// Export for programmatic usage
export { start } from "./controller.js"
export type { Config } from "./types.js"
