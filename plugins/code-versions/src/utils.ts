import { type ClassValue, clsx } from "clsx"
import { useRef } from "react"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Asserts that a condition is true, throwing an error if it's not
 */
export function assert(condition: boolean, message?: string): asserts condition {
    if (!condition) {
        throw new Error(message ?? "Assertion failed")
    }
}

/**
 * Returns the time in ms between mount and when isLoading becomes false.
 * Only updates once per mount cycle.
 */
export function useTimeBetweenMountedAndLoaded(isLoading: boolean) {
    const mountTime = useRef<number>()
    const loadedTime = useRef<number>()

    // Set mount time on first render
    // or reset if loading starts again
    if (!mountTime.current || (loadedTime.current && isLoading)) {
        mountTime.current = Date.now()
        loadedTime.current = undefined
    }

    // Set loaded time when loading finishes
    if (!isLoading && !loadedTime.current) {
        loadedTime.current = Date.now()
    }

    if (!loadedTime.current) return undefined

    return loadedTime.current - mountTime.current
}

export function shouldAnimateAfterLoadingDuration(loadingDuration: number | undefined, thresholdInMs: number) {
    return loadingDuration ? loadingDuration > thresholdInMs : false
}
