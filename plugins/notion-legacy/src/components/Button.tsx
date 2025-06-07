import { Spinner } from "./Spinner"
import classNames from "classnames"

export type ButtonProps = React.ComponentProps<"button"> & {
    isLoading?: boolean
    variant?: "primary" | "normal"
}

export function Button({ className, isLoading, disabled, variant, children, ...props }: ButtonProps) {
    return (
        <button
            className={classNames("relative", variant === "primary" && "framer-button-primary", className)}
            disabled={isLoading || disabled}
            {...props}
        >
            <span className={isLoading ? "invisible" : undefined}>{children}</span>
            {isLoading && (
                <div className="absolute top-0 right-0 left-0 bottom-0 flex items-center justify-center">
                    <Spinner color={variant === "primary" ? "light" : "system"} />
                </div>
            )}
        </button>
    )
}
