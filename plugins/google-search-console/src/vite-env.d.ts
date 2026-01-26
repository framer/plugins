/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_MOCK_DATA?: string
    readonly VITE_LOCAL?: string
}

interface ViteTypeOptions {
    strictImportMetaEnv: unknown
}
