import { useEffect, useMemo, useState } from "react"
import { formatRelative } from "../utils/date"

interface FormatFromNowProps {
    date: Date | string
    locales?: Intl.LocalesArgument
}

export function FormatFromNow({ date, locales }: FormatFromNowProps) {
    const [now, setNow] = useState(() => new Date())
    const targetDate = useMemo(() => (typeof date === "string" ? new Date(date) : date), [date])

    useEffect(() => {
        // shortest interval we show is Now and 1m, so 10s is enough
        const id = setInterval(() => setNow(new Date()), 10_000)
        return () => clearInterval(id)
    }, [])

    return <span>{formatRelative(now, targetDate, locales)}</span>
}
