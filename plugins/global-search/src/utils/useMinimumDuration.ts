import { useEffect, useRef, useState } from "react"

/**
 * Hook that ensures a boolean value stays `true` for a minimum duration.
 * When the input becomes `true`, it immediately returns `true`.
 * When the input becomes `false`, it delays returning `false` for the specified duration.
 * If the input becomes `true` again during the delay, the delay is cancelled.
 *
 * @param value - The boolean value to control
 * @param minDuration - Minimum duration in milliseconds to keep the value `true`
 * @returns The controlled boolean value
 */
export function useMinimumDuration(value: boolean, minDuration: number): boolean {
    const [delayedValue, setDelayedValue] = useState(value)
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

    useEffect(() => {
        if (value) {
            clearTimeout(timeoutRef.current)
            setDelayedValue(true)
        } else if (delayedValue) {
            timeoutRef.current = setTimeout(() => {
                setDelayedValue(false)
            }, minDuration)
        }

        return () => {
            clearTimeout(timeoutRef.current)
        }
    }, [value, delayedValue, minDuration])

    return delayedValue
}
