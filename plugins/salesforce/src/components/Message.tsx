import cx from "classnames"

interface Props {
    title: string
    children: React.ReactNode
    className?: string
}

export const Message = ({ title, className, children }: Props) => (
    <div className={cx("col items-center justify-center h-full p-[15px] no-scrollbar overflow-y-auto", className)}>
        <p className="text-primary">{title}</p>
        <div className="text-tertiary text-center max-w-[200px] break-words no-scrollbar overflow-y-auto">
            {children}
        </div>
    </div>
)
