import { framer, type MenuItem } from "framer-plugin"
import { memo, type ReactNode, useCallback, useRef } from "react"

interface MenuProps {
    items: MenuItem[]
    children: ReactNode
}

export const Menu = memo(function Menu({ items, children }: MenuProps) {
    const buttonRef = useRef<HTMLButtonElement>(null)

    const toggleMenu = useCallback(
        async (event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => {
            if (!buttonRef.current) return
            if ("key" in event && event.key !== "Enter" && event.key !== " ") return

            const buttonBounds = buttonRef.current.getBoundingClientRect()

            await framer.showContextMenu(items, {
                location: { x: buttonBounds.right - 5, y: buttonBounds.bottom },
                placement: "bottom-left",
                width: 200,
            })
        },
        [items]
    )

    return (
        <div className="relative">
            <button
                type="button"
                ref={buttonRef}
                onMouseDown={toggleMenu}
                onKeyDown={toggleMenu}
                className="border border-amber-500 group size-6 text-white rounded-md flex-shrink-0 flex items-center justify-center bg-transparent p-0 focus-visible:outline-none hover:text-framer-text-base focus-visible:text-framer-text-base disabled:opacity-50 disabled:pointer-events-none disabled:cursor-default visible"
                aria-haspopup="true"
            >
                <div className="flex items-center justify-center w-fit h-fit flex-shrink-0 bg-transparent text-framer-text-tertiary group-hover:text-framer-text-base group-focus-visible:text-framer-text-base">
                    {children}
                </div>
            </button>
        </div>
    )
})
