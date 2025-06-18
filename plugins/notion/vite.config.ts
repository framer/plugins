import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"
import framer from "vite-plugin-framer"
import mkcert from "vite-plugin-mkcert"

export default defineConfig({ plugins: [react(), mkcert(), framer()] })
