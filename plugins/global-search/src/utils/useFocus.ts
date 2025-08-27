import type { FocusableElement } from "@react-types/shared"
import { useCallback } from "react"
import { useFocusManager } from "react-aria"

export function useFocusHandlers() {
    const focusManager = useFocusManager()

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
            const isResultMatch = (element: Element) =>
                element.id === "text-search-input" || element.matches("[data-result-match]")
            let next: FocusableElement | null | undefined
            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault()
                    next = focusManager?.focusNext({
                        accept: isResultMatch,
                    })
                    break
                case "ArrowUp":
                    event.preventDefault()
                    next = focusManager?.focusPrevious({
                        accept: isResultMatch,
                    })
                    break
            }

            next?.scrollIntoView({ behavior: "smooth", block: "center" })
        },
        [focusManager]
    )

    return {
        onKeyDown,
    }
}
