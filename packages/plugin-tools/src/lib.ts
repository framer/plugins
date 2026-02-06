import AdmZip from "adm-zip"
import { exec } from "child_process"
import fs from "fs"
import path from "path"

/**
 * Naive package manager detection by checking for lock files in the current directory and parent directories.
 * @param cwd - The current working directory.
 * @returns the package manager entrypoint CLI command.
 */
export function detectPackageManager(cwd: string): string {
    let dir = cwd
    for (let i = 0; i < 3; i++) {
        const hasFile = (name: string) => fs.existsSync(path.join(dir, name))

        if (hasFile("yarn.lock")) return "yarn"
        if (hasFile("pnpm-lock.yaml")) return "pnpm"
        if (hasFile("bun.lockb") || hasFile("bun.lock")) return "bun"
        if (hasFile("package-lock.json")) return "npm"

        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }
    return "npm"
}

interface ZipPluginDistributionOptions {
    cwd: string
    distPath: string
    zipFileName: string
}

export function zipPluginDistribution(options: ZipPluginDistributionOptions): string {
    const distPath = path.isAbsolute(options.distPath) ? options.distPath : path.join(options.cwd, options.distPath)

    if (!fs.existsSync(distPath)) {
        throw new Error(`${distPath} does not exist`)
    }

    if (!fs.statSync(distPath).isDirectory()) {
        throw new Error(`${distPath} is not directory`)
    }

    const zipFilePath = path.isAbsolute(options.zipFileName)
        ? options.zipFileName
        : path.join(options.cwd, options.zipFileName)

    const zip = new AdmZip()
    zip.addLocalFolder(distPath)
    zip.writeZip(zipFilePath)

    return zipFilePath
}

export function runPluginBuildScript(cwd: string, buildCommandOverride?: string): Promise<void> {
    let buildCommand: string
    if (buildCommandOverride) {
        buildCommand = buildCommandOverride
        console.log(`Using custom build command: ${buildCommand}`)
    } else {
        const packageManager = detectPackageManager(cwd)
        console.log(`Detected package manager: ${packageManager}`)
        buildCommand = `${packageManager} run build`
    }

    return new Promise((resolve, reject) => {
        const buildProcess = exec(buildCommand, { cwd })

        buildProcess.stdout?.on("data", (data: string) => process.stdout.write(data))
        buildProcess.stderr?.on("data", (data: string) => process.stderr.write(data))

        buildProcess.on("exit", code => {
            if (code !== 0) {
                reject(new Error(`Failed to build Plugin. Exit code: ${code ?? "unknown"}`))
                return
            }
            resolve()
        })

        buildProcess.on("error", err => {
            reject(new Error(`Failed to start build process: ${err.message}`))
        })
    })
}
