import { framer, type MenuItem } from "framer-plugin"
import { memo, type ReactNode, useCallback, useRef } from "react"
import { cn } from "../../utils/className"

interface MenuProps {
    items: MenuItem[]
    children: ReactNode
    className?: string | undefined
}

export const Menu = memo(function Menu({ items, children, className }: MenuProps) {
    const buttonRef = useRef<HTMLButtonElement>(null)

    const toggleMenu = useCallback(
        (event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => {
            if (!buttonRef.current) return
            if ("key" in event && event.key !== "Enter" && event.key !== " ") return

            const buttonBounds = buttonRef.current.getBoundingClientRect()

            framer
                .showContextMenu(items, {
                    location: { x: buttonBounds.right - 5, y: buttonBounds.bottom },
                    placement: "bottom-left",
                })
                .catch((error: unknown) => {
                    framer.notify(
                        `Failed to show context menu. ${error instanceof Error ? error.message : "Unknown error"}`,
                        {
                            variant: "error",
                        }
                    )
                })
        },
        [items]
    )

    return (
        <div className={cn("relative h-full flex items-center", className)}>
            <button
                type="button"
                ref={buttonRef}
                onMouseDown={toggleMenu}
                onKeyDown={toggleMenu}
                className="group h-full -mx-2 px-2 -my-3 py-3 text-white rounded-md flex-shrink-0 flex items-center justify-center bg-transparent outline-focus-ring-light dark:outline-focus-ring-dark hover:text-primary-light dark:hover:text-primary-dark focus:text-primary-light dark:focus:text-primary-dark disabled:opacity-50 disabled:pointer-events-none disabled:cursor-default visible"
                aria-haspopup="true"
            >
                <div className="flex items-center justify-center w-fit h-fit flex-shrink-0 bg-transparent text-tertiary-light dark:text-tertiary-dark group-hover:text-primary-light dark:group-hover:text-primary-dark group-focus:text-primary-light dark:group-focus:text-primary-dark">
                    {children}
                </div>
            </button>
        </div>
    )
})
