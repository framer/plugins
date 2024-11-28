import { Spinner, SpinnerProps } from "./Spinner"
import cx from "classnames"

export const CenteredSpinner = ({ className, size }: { className?: string; size?: SpinnerProps["size"] }) => (
    <div className={cx("flex items-center justify-center m-auto", className)}>
        <Spinner inheritColor inline size={size} />
    </div>
)
