import { defineConfig } from "tsdown"

export default defineConfig({
	entry: ["src/index.ts"],
	format: "esm",
	noExternal: ["@code-link/shared"],
})

