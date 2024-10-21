import cx from "classnames"

export const Indicator = ({ type }: { type: "error" | "warning" | "notice" }) => {
    const color = {
        "bg-framer-red": type === "error",
        "bg-framer-yellow": type === "warning",
        "bg-framer-blue": type === "notice",
    }

    return (
        <div className={cx("min-w-5 min-h-5 flex items-center justify-center rounded-full bg-opacity-20", color)}>
            <div className={cx("rounded-full w-[10px] h-[10px]", color)}></div>
        </div>
    )
}
