import cx from "classnames"

export const CenteredSpinner = ({ className, large = false }: { className?: string; large?: boolean }) => (
    <div className={cx("flex items-center justify-center m-auto", className)}>
        <div className={large ? "framer-spinner-large" : "framer-spinner"} />
    </div>
)
