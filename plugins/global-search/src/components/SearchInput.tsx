import type { DetailedHTMLProps } from "react"
import { cn } from "../utils/className"
import { isHeader } from "../utils/selection/constants"
import { useSelection } from "../utils/selection/useSelection"
import { IconSearch } from "./ui/IconSearch"

type SearchInputProps = DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>

export function SearchInput({ className, ...props }: SearchInputProps) {
    const { inputFocusProps, activeId } = useSelection()
    const activeDescendant = activeId && !isHeader(activeId) ? activeId : undefined

    return (
        <label className={cn("flex items-center gap-2 flex-1", className)}>
            <span className="sr-only">Search for anything in your Framer project</span>
            <IconSearch aria-hidden className="text-tertiary-light dark:text-tertiary-dark" />
            <input
                type="text"
                className="flex-1 h-[18px] bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-xs p-0 text-primary-light dark:text-primary-dark placeholder:text-tertiary-light dark:placeholder:text-tertiary-dark"
                placeholder="Search..."
                autoFocus
                aria-activedescendant={activeDescendant}
                onKeyDown={e => {
                    inputFocusProps.onKeyDown(e)
                    if (!e.defaultPrevented) props.onKeyDown?.(e)
                }}
                {...props}
            />
        </label>
    )
}
