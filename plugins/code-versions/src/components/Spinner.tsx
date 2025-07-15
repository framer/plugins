import { cn } from "../utils"

interface SpinnerProps {
    className?: string
}

export function Spinner({ className }: SpinnerProps) {
    return (
        <div
            className={cn(
                "flex items-center justify-center z-10 animate-(--fade-in-animation) [animation-delay:800ms] opacity-0",
                className
            )}
        >
            <div className="framer-spinner" />
        </div>
    )
}
