import { useEffect, useMemo, useState } from "react"
import { formatRelative, getNextUpdateInterval } from "../utils/date"

interface FormatFromNowProps {
    date: Date | string
    locales?: Intl.LocalesArgument
}

export function FormatFromNow({ date, locales }: FormatFromNowProps) {
    const [now, setNow] = useState(() => new Date())
    const targetDate = useMemo(() => (typeof date === "string" ? new Date(date) : date), [date])

    useEffect(() => {
        let timeoutId: number

        function updateNow() {
            const currentNow = new Date()
            setNow(currentNow)
            const nextInterval = getNextUpdateInterval(currentNow, targetDate)
            if (timeoutId) window.clearTimeout(timeoutId)
            timeoutId = window.setTimeout(updateNow, nextInterval)
        }

        timeoutId = window.setTimeout(updateNow, 10_000)

        return () => {
            clearTimeout(timeoutId)
        }
    }, [targetDate])

    return <span>{formatRelative(now, targetDate, locales)}</span>
}
