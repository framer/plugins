import { Spinner, SpinnerProps } from "./Spinner"
import classNames from "classnames"

export const CenteredSpinner = ({ className, size }: { className?: string; size?: SpinnerProps["size"] }) => (
    <div className={classNames("flex items-center justify-center py-10", className)}>
        <Spinner inheritColor inline size={size} />
    </div>
)
