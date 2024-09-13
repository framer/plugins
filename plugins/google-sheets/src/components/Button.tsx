import cx from "classnames"
import { Spinner } from "./Spinner"

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary"
    isLoading?: boolean
}

export const Button = ({ variant = "primary", children, className, isLoading = false, disabled, ...rest }: Props) => (
    <button
        className={cx(
            "flex justify-center items-center relative py-2",
            {
                "framer-button-primary": variant === "primary",
                "framer-button-secondary": variant === "secondary",
            },
            className
        )}
        disabled={isLoading || disabled}
        {...rest}
    >
        {isLoading ? (
            <div className="p-5">
                <Spinner inheritColor={variant === "secondary"} />
            </div>
        ) : (
            children
        )}
    </button>
)
