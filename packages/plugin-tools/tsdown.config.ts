import { defineConfig } from "tsdown"

export default defineConfig([
    // CLI binary
    {
        entry: { cli: "src/cli.ts" },
        format: "esm",
        target: "node22",
        fixedExtension: false,
        banner: {
            js: "#!/usr/bin/env node",
        },
    },
    // Library exports
    {
        entry: { index: "src/index.ts" },
        format: "esm",
        target: "node22",
        fixedExtension: false,
        dts: true,
    },
])
