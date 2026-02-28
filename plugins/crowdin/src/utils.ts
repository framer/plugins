/** Parse BCP 47–style code (e.g. "en-US", "zh-Hans") into language and optional region for createLocale. */
export function parseLocaleCode(code: string): { language: string; region?: string } {
    const parts = code.split("-")
    if (parts.length <= 1) return { language: code }
    const last = parts[parts.length - 1]
    if (last && last.length === 2 && /^[a-zA-Z]{2}$/.test(last)) {
        return {
            language: parts.slice(0, -1).join("-"),
            region: last,
        }
    }
    return { language: code }
}
