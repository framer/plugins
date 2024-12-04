import { Spinner, SpinnerProps } from "./Spinner"
import classNames from "classnames"

export const CenteredSpinner = ({ className }: SpinnerProps) => (
    <div className={classNames("flex items-center justify-center m-auto", className)}>
        <Spinner inheritColor inline />
    </div>
)
