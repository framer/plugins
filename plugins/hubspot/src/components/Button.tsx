interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean
}

export const Button = ({ children, className, isLoading = false, disabled, ...rest }: Props) => (
    <button className={className} disabled={isLoading || disabled} {...rest}>
        {isLoading ? <div className="framer-spinner" /> : children}
    </button>
)
