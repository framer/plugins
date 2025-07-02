import { useEffect, useMemo, useState } from "react"
import { formatRelative } from "../utils/date"

interface FormatFromNowProps {
    date: Date | string
    locales?: Intl.LocalesArgument
    intervalMs?: number
}

export function FormatFromNow({ date, locales, intervalMs = 60000 }: FormatFromNowProps) {
    const [now, setNow] = useState(() => new Date())

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), intervalMs)
        return () => clearInterval(id)
    }, [intervalMs])

    const targetDate = useMemo(() => new Date(date), [date])

    return <span>{formatRelative(now, targetDate, locales)}</span>
}
