/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PROXY_URL?: string
    readonly VITE_AI_API_URL?: string
    readonly VITE_ALT_TEXT_API_URL?: string
}

interface ViteTypeOptions {
    strictImportMetaEnv: unknown
}
