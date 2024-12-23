import cx from "classnames"

export const IconChevron = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="5"
        height="8"
        className={cx("fill-transparent stroke-[#999] stroke-[1.5] stroke-round stroke-linejoin-round", className)}
    >
        <path d="M 1 1 L 4 4 L 1 7"></path>
    </svg>
)
