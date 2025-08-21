import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import defaultConfig from "@framer/vite-config"
import { transformSync } from "esbuild"
import { defineConfig } from "vite"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Plugin to compile and minify yieldGTMCalls.ts
function compileYieldGTMCalls() {
    return {
        name: "compile-yield-gtm-calls",
        resolveId(id: string) {
            if (id === "virtual:yield-gtm-calls") {
                return id
            }
        },
        load(id: string) {
            if (id === "virtual:yield-gtm-calls") {
                const filePath = resolve(__dirname, "src/yieldGTMCalls.ts")
                const source = readFileSync(filePath, "utf-8")

                // Compile and minify with esbuild
                const result = transformSync(source, {
                    loader: "ts",
                    target: "es2022",
                    minify: true,
                    format: "iife",
                })

                return `export default ${JSON.stringify(result.code)}`
            }
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    ...defaultConfig,
    plugins: [...defaultConfig.plugins, compileYieldGTMCalls()],
})
