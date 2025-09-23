import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { isHeader, NavigationDirection } from "./constants"
import { SelectionContext } from "./context"

export function SelectionProvider({ children }: { children: React.ReactNode }) {
    const [activeId, setActiveId] = useState<string | null>(null)
    const idsRef = useRef<readonly string[]>([])
    const inputRef = useRef<HTMLInputElement | null>(null)

    // scroll to active id
    useLayoutEffect(() => {
        if (!activeId) return
        document.getElementById(activeId)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, [activeId])

    const setItems = useCallback(
        (ids: readonly string[]) => {
            idsRef.current = ids
            if (ids.length === 0) setActiveId(null)
            // if active id is not in the new ids, clear the active id
            // either the group is collapsed or the item is no longer in the results
            if (activeId && !ids.includes(activeId)) setActiveId(null)
        },
        [activeId]
    )

    const nextIndex = useCallback((fromIndex: number | null, direction: NavigationDirection): number | null => {
        const itemCount = idsRef.current.length
        const start = fromIndex ?? (direction === NavigationDirection.Down ? -1 : itemCount)
        const idx = start + direction
        return idx < 0 || idx >= itemCount
            ? null // out of bounds and clear
            : idx
    }, [])

    const findNextSelectable = useCallback(
        (fromIndex: number | null, direction: NavigationDirection): string | null => {
            const idx = nextIndex(fromIndex, direction)
            if (idx === null) return null
            const id = idsRef.current[idx]
            // skip headers and continue searching
            if (isHeader(id)) return findNextSelectable(idx, direction)

            return id ?? null
        },
        [nextIndex]
    )

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault()
                // Ensure the search input retains focus while navigating, prevents other elements from being focused
                inputRef.current?.focus()
                const currentIndex = activeId ? idsRef.current.indexOf(activeId) : null
                const direction = event.key === "ArrowDown" ? NavigationDirection.Down : NavigationDirection.Up
                const nextId = findNextSelectable(currentIndex, direction)
                // end on the last or first item when repeating
                if (event.repeat && nextId === null) return
                setActiveId(nextId)
            } else if (event.key === "Enter" && activeId && !isHeader(activeId)) {
                document.getElementById(activeId)?.click()
                event.preventDefault()
            }
        },
        [activeId, findNextSelectable]
    )

    const value = useMemo(
        () => ({
            activeId,
            setItems,
            getFocusProps: (id: string) => ({
                id,
                onFocus: () => {
                    setActiveId(id)
                },
                onKeyDown: handleKeyDown,
            }),
            inputFocusProps: { onKeyDown: handleKeyDown },
            inputRef: (el: HTMLInputElement | null) => {
                inputRef.current = el
            },
        }),
        [activeId, setItems, handleKeyDown]
    )

    return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}
