import type { Locale } from "framer-plugin"

/**
 * Unified locale representation for Framer locales and Crowdin target languages.
 */
export interface PluginLocale {
    /** Selection/lookup id: Framer locale id in export mode, Crowdin code in import mode. */
    id: string
    name: string
    /** BCP-47 language code (e.g. "en-US"). */
    code: string
}

export function fromFramerLocale(locale: Locale): PluginLocale {
    return { id: locale.id, name: locale.name, code: locale.code }
}

export function fromCrowdinTarget(ct: { id: string; name: string }, fallbackName?: string): PluginLocale {
    return { id: ct.id, name: fallbackName ?? ct.name, code: ct.id }
}
