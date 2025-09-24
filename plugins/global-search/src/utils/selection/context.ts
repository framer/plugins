import { createContext, type FocusEventHandler, type KeyboardEventHandler } from "react"

export interface SelectionContextValue {
    readonly activeId: string | null
    /** Update item ids for navigation. Include headers with HDR_PREFIX. */
    readonly setItems: (ids: readonly string[]) => void
    /** Focus props for an element with given id. */
    readonly getFocusProps: (id: string) => {
        id: string
        onFocus: FocusEventHandler<HTMLElement>
        onKeyDown: KeyboardEventHandler<HTMLElement>
    }
    /** Focus props for the input. */
    readonly inputFocusProps: { onKeyDown: KeyboardEventHandler<HTMLElement> }
    /** Register the search input element so provider can control focus. */
    readonly inputRef: (el: HTMLInputElement | null) => void
}

export const SelectionContext = createContext<SelectionContextValue | null>(null)
