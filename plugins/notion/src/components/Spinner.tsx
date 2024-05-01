import cx from "classnames"
import styles from "./spinner.module.css"

export interface SpinnerProps {
    /** Size of the spinner */
    size?: "normal" | "medium" | "large"
    color?: "light" | "dark" | "system"
    /** Set the spinner to have a static position inline with other content */
    inline?: boolean
    className?: string
    inheritColor?: boolean
}

function styleForSize(size: SpinnerProps["size"]) {
    switch (size) {
        case "normal":
            return styles.normalStyle
        case "medium":
            return styles.mediumStyle
        case "large":
            return styles.largeStyle
    }
}

function styleForcolor(size: SpinnerProps["color"]) {
    switch (size) {
        case "light":
            return styles.lightStyle
        case "dark":
            return styles.darkStyle
        default:
            return styles.systemStyle
    }
}

function spinnerClassNames(size: SpinnerProps["size"] = "normal", color: SpinnerProps["color"] = "system") {
    return cx(styles.spin, styles.baseStyle, styleForSize(size), styleForcolor(color))
}

export const Spinner = ({ size, inline = false, color, inheritColor, className, ...rest }: SpinnerProps) => {
    return (
        <div
            className={cx(
                className,
                spinnerClassNames(size, color),
                inheritColor && styles.buttonWithDepthSpinner,
                !inline && styles.centeredStyle
            )}
            {...rest}
        />
    )
}
