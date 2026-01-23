import cx from "classnames"

export const CenteredSpinner = ({ className }: { className?: string }) => (
    <div className={cx("flex items-center justify-center m-auto", className)}>
        <div className="framer-spinner" />
    </div>
)
