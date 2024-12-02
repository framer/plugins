import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import mkcert from "vite-plugin-mkcert";
import framer from "vite-plugin-framer";

export default defineConfig({
  plugins: [svelte(), mkcert(), framer()],
});
