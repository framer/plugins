import cx from "classnames"

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean
}

export const Button = ({ variant = "secondary", children, className, isLoading = false, disabled, ...rest }: Props) => (
    <button
        className={cx(variant === "primary" && "framer-button-primary", className)}
        disabled={isLoading || disabled}
        {...rest}
    >
        {isLoading ? <div className="framer-spinner" /> : children}
    </button>
)
