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

/**
 * Calculates the next update interval in milliseconds based on the time difference
 * between two dates. Uses the same logic as formatRelative to determine appropriate intervals.
 */
export function getNextUpdateInterval(from: Date, to: Date): number {
    const diff = from.getTime() - to.getTime()
    const seconds = Math.floor(diff / 1000)

    if (seconds < 60) {
        // "Just now" - update every 10 seconds
        return 10_000
    } else if (seconds < 3600) {
        // "Xm ago" - update every minute
        return 60_000
    } else if (seconds < 86400) {
        // "Xh ago" - update every 5 minutes
        return 5 * 60_000
    } else if (seconds < 7 * 86400) {
        // "Xd ago" - update every hour
        return 60 * 60_000
    } else {
        // Full date - no need to update frequently
        return 24 * 60 * 60_000 // 24 hours
    }
}
