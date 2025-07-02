/**
 * Formats a date as a relative time string (e.g., "2 minutes ago", "yesterday")
 * Uses the native Intl.RelativeTimeFormat API for proper localization and pluralization
 */
export function formatRelative(from: Date | string, to: Date | string, locales?: Intl.LocalesArgument): string {
    const fromDate = typeof from === "string" ? new Date(from) : from
    const toDate = typeof to === "string" ? new Date(to) : to

    const diff = fromDate.getTime() - toDate.getTime()

    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return `${Math.abs(seconds)}s ago`

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${Math.abs(minutes)}m ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${Math.abs(hours)}h ago`

    const days = Math.floor(hours / 24)
    if (days < 7) return `${Math.abs(days)}d ago`

    return toDate.toLocaleDateString(locales)
}

/**
 * Formats a date in a full format (e.g., "23/12/25 • 2:30pm")
 */
export function formatFull(date: Date | string, locales?: Intl.LocalesArgument): string {
    const dateObj = typeof date === "string" ? new Date(date) : date

    const datePart = dateObj.toLocaleDateString(locales, {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
    })
    const timePart = dateObj
        .toLocaleTimeString(locales, {
            hour: "2-digit",
            minute: "2-digit",
        })
        .toLowerCase()

    return `${datePart} \u2022 ${timePart}`
}
