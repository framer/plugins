import { svelte } from "@sveltejs/vite-plugin-svelte"
import type { UserConfig } from "vite"
import framer from "vite-plugin-framer"
import mkcert from "vite-plugin-mkcert"

export default { plugins: [svelte(), mkcert(), framer()] } satisfies UserConfig
