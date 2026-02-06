import { defineConfig } from "tsup"

export default defineConfig([
    // CLI binary
    {
        entry: { cli: "src/cli.ts" },
        format: ["esm"],
        target: "node22",
        banner: {
            js: "#!/usr/bin/env node",
        },
    },
    // Library exports
    {
        entry: { index: "src/index.ts" },
        format: ["esm"],
        target: "node22",
        dts: true,
    },
])
