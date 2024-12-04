import { useSearch } from "wouter"

export const useSearchParams = () => {
    const searchString = useSearch()
    const searchParams = new URLSearchParams(searchString)

    return searchParams
}
