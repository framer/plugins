import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import mkcert from "vite-plugin-mkcert";
import framer from "vite-plugin-framer";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/renamer" : "",
  plugins: [svelte(), mkcert(), framer()],
});
