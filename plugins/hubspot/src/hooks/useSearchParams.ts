import { useSearch, useLocation } from "wouter"
import { useMemo, useCallback } from "react"

export const useSearchParams = <T extends Record<string, string>>() => {
    const searchString = useSearch()
    const [, setLocation] = useLocation()

    // Parse current search params
    const params = useMemo(() => {
        const searchParams = new URLSearchParams(searchString)
        return Object.fromEntries(searchParams.entries()) as T
    }, [searchString])

    const setSearchParams = useCallback(
        (newParams: Partial<T>) => {
            const currentParams = new URLSearchParams(searchString)

            // Update or add new params
            Object.entries(newParams).forEach(([key, value]) => {
                if (value === null || value === undefined) {
                    currentParams.delete(key)
                } else {
                    currentParams.set(key, value)
                }
            })

            const pathname = location.pathname
            const newSearch = currentParams.toString()
            const newUrl = `${pathname}${newSearch ? `?${newSearch}` : ""}`

            setLocation(newUrl)
        },
        [searchString, setLocation]
    )

    return [params, setSearchParams] as const
}
