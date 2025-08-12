import type { DetailedHTMLProps } from "react"
import { cn } from "../utils/className"
import { IconSearch } from "./ui/IconSearch"

type SearchInputProps = DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>

export function SearchInput({ className, ...props }: SearchInputProps) {
    return (
        <label className="flex items-center gap-2 text-framer-text-tertiary flex-1 border border-amber-500 rounded-md -ml-1 pl-2">
            <span className="sr-only">Search for anything in your Framer project</span>
            <IconSearch aria-hidden />
            <input
                type="text"
                className={cn(
                    "flex-1 bg-transparent border-none outline-none focus-visible:outline-none focus-visible:ring-0 text-xs selection:bg-amber-500",
                    className
                )}
                placeholder="Search..."
                {...props}
            />
        </label>
    )
}
