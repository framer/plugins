/**
 * Formats a date as a relative time string (e.g., "2 minutes ago", "yesterday")
 * Uses the native Intl.RelativeTimeFormat API for proper localization and pluralization
 */
export function formatRelative(from: Date, to: Date, locales?: Intl.LocalesArgument): string {
    const diff = from.getTime() - to.getTime()

    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return "Just now"

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${Math.abs(minutes)}m ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${Math.abs(hours)}h ago`

    const days = Math.floor(hours / 24)
    if (days < 7) return `${Math.abs(days)}d ago`

    return to.toLocaleDateString(locales)
}
