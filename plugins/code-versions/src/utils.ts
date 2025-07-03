import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Type guard function that checks if a value is not null
 */
export function isNotNull<T>(value: T | null): value is T {
    return value !== null
}
