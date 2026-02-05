import { program } from "@commander-js/extra-typings"
import { runPluginBuildScript, zipPluginDistribution } from "./lib"

const defaultDistDir = "dist"
const defaultOutputFilename = "plugin.zip"
const defaultCWD = process.cwd()

program.name("framer-plugin").description("CLI tools for Framer Plugins").version("1.1.0")

program
    .command("pack")
    .alias("prepare") // Backwards compatibility but was never documented
    .description("Build and package your plugin into a zip file")
    // Uppercase -C matches familiar git shorthands
    .option("-C, --cwd <dir>", "plugin project directory", defaultCWD)
    .option("-d, --dist-dir <dir>", "output directory for the build", defaultDistDir)
    .option("-b, --build-command <cmd>", "custom build command (e.g., 'npm run build:prod')")
    .option("--prebuilt", "skip the build step and only create the zip")
    .option("-o, --output <filename>", "output zip filename", defaultOutputFilename)
    .action(async options => {
        if (!options.prebuilt) {
            console.log("Building your Plugin…")
            await runPluginBuildScript(options.cwd, options.buildCommand)
        }

        console.log(`Creating ${options.output} file…`)

        zipPluginDistribution({
            cwd: options.cwd,
            distPath: options.distDir,
            zipFileName: options.output,
        })

        console.log(
            `\n⚡️ ${options.output} file has been created in ${options.cwd} \n Submit your Plugin on the Framer Marketplace: https://www.framer.com/marketplace/dashboard/plugins/`
        )
    })

program.parse(process.argv)
