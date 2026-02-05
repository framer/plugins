import AdmZip from "adm-zip"
import { exec } from "child_process"
import fs from "fs"
import path from "path"

interface PackPluginOptions {
    cwd: string
    distPath: string
    zipFileName: string
}

interface PackPluginResult {
    zipPath: string
}

/**
 * Naive package manager detection by checking for lock files in the current directory and parent directories.
 * @param cwd
 * @returns
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

export function packPlugin(options: PackPluginOptions): PackPluginResult {
    const distPath = path.join(options.cwd, options.distPath)

    if (!fs.existsSync(distPath)) {
        throw new Error(
            `The 'dist' directory does not exist at ${distPath}. Please make sure to build the Plugin first and that the build output is in the 'dist' directory.`
        )
    }

    const zipPath = path.join(options.cwd, options.zipFileName)

    const zip = new AdmZip()
    zip.addLocalFolder(distPath)
    zip.writeZip(zipPath)

    return { zipPath }
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
