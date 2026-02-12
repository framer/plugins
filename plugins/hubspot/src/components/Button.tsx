import cx from "classnames"

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "destructive"
    isLoading?: boolean
}

export const Button = ({ variant = "primary", children, className, isLoading = false, disabled, ...rest }: Props) => (
    <button className={cx(`framer-button-${variant}`, className)} disabled={isLoading || disabled} {...rest}>
        {isLoading ? <div className="framer-spinner" /> : children}
    </button>
)
