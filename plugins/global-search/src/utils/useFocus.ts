import type { FocusableElement } from "@react-types/shared"
import { useCallback } from "react"
import { useFocusManager } from "react-aria"

const inputId = "text-search-input"
const resultDataAttribute = "data-result-match"

const propsByType = {
    input: { id: inputId },
    match: { [resultDataAttribute]: true },
    "match-group": null,
} as const

export function useFocusHandlers(type: keyof typeof propsByType) {
    const focusManager = useFocusManager()

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
            const isResultMatch = (element: Element) =>
                element.id === inputId || element.matches(`[${resultDataAttribute}]`)
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
        ...propsByType[type],
    }
}
