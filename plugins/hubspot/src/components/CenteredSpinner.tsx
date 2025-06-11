import cx from "classnames"
import { type SpinnerProps, Spinner } from "./Spinner"

export const CenteredSpinner = ({ className, size }: { className?: string; size?: SpinnerProps["size"] }) => (
    <div className={cx("flex items-center justify-center m-auto", className)}>
        <Spinner inheritColor inline size={size} />
    </div>
)
