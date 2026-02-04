import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        pool: "threads", // Fork pool trips tinypool on Node 25; threads stay stable
    },
})
