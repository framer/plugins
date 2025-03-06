import react from "@vitejs/plugin-react-swc"
import { resolve } from "path"
import { defineConfig } from "vite"
import framer from "vite-plugin-framer"
import mkcert from "vite-plugin-mkcert"

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), mkcert(), framer()],
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
})
