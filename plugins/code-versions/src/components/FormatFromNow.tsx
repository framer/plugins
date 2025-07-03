import { useEffect, useState } from "react"
import { formatRelative } from "../utils/date"

interface FormatFromNowProps {
    date: Date | string
    locales?: Intl.LocalesArgument
}

function getInitialIntervalMs(diff: number) {
    if (diff < 60 * 1000) return 10 * 1000 // update every ~10 seconds (since display shows "now" until 60s)
    if (diff < 60 * 60 * 1000) return 60 * 1000 // update every minute
    if (diff < 24 * 60 * 60 * 1000) return 60 * 60 * 1000 // update every hour
    if (diff < 7 * 24 * 60 * 60 * 1000) return 24 * 60 * 60 * 1000 // update every day
    return null // no update needed
}

export function FormatFromNow({ date, locales }: FormatFromNowProps) {
    const [now, setNow] = useState(() => new Date())
    const targetDate = new Date(date)
    const diff = now.getTime() - targetDate.getTime()
    const [intervalMs] = useState(() => getInitialIntervalMs(diff))

    useEffect(() => {
        if (intervalMs === null) return
        const id = setInterval(() => setNow(new Date()), intervalMs)
        return () => clearInterval(id)
    }, [intervalMs])

    return <span>{formatRelative(now, targetDate, locales)}</span>
}
