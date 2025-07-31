/// <reference types="vite/client" />

interface ViteTypeOptions {
    strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
    readonly VITE_MOCK_DATA?: string
    readonly VITE_OAUTH_API_DOMAIN: string
}
