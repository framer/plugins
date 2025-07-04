import { type ClassValue, clsx } from "clsx"
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
