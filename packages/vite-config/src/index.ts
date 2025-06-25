import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import type { UserConfig } from "vite"
import framer from "vite-plugin-framer"
import mkcert from "vite-plugin-mkcert"

export default { plugins: [react(), mkcert(), framer(), tailwindcss()] } satisfies UserConfig
