import cx from "classnames"

interface Props extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    className?: string
}

export const TableContainer = ({ children, className, ...rest }: Props) => (
    <div className={cx("col-lg w-full h-fit", className)} {...rest}>
        {children}
    </div>
)

export const TableHead = ({ children, className, ...rest }: Props) => (
    <div className={cx("flex gap-5 border-b border-divider min-h-30 w-full text-secondary", className)} {...rest}>
        {children}
    </div>
)

export const TableRow = ({ children, className, ...rest }: Props) => (
    <div className={cx("flex gap-5 min-h-30", className)} {...rest}>
        {children}
    </div>
)

export const TableCell = ({ children, className, ...rest }: Props) => (
    <div className={cx("flex items-center gap-[5px] min-w-[65px]", className)} {...rest}>
        {children}
    </div>
)

export const TableBody = ({ children, className, ...rest }: Props) => (
    <div
        className={cx(
            "flex flex-col gap-15 w-full max-h-[500px] overflow-y-auto overflow-x-hidden text-primary",
            className
        )}
        {...rest}
    >
        {children}
    </div>
)
