import type { FocusableElement } from "@react-types/shared"
import { useCallback } from "react"
import { useFocusManager } from "react-aria"

const navigationSelectableAttribute = "data-navigation-selectable"

const isResultMatch = (element: Element) => element.hasAttribute(navigationSelectableAttribute)

export function useFocusHandlers({
    isSelfSelectable,
}: {
    /** If the element itself can be naviagated to (e.g. input or individual match), or if it is just the receiver of the key events (e.g. match group) */
    isSelfSelectable: boolean
}) {
    const focusManager = useFocusManager()

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
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
        ...(isSelfSelectable ? { [navigationSelectableAttribute]: true } : null),
    }
}
