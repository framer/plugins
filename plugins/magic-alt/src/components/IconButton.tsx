import React, { forwardRef } from "react"
import cx from "classnames"

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode
    className?: string
}

export const IconButton = forwardRef<HTMLButtonElement, Props>(({ className, children, ...rest }, ref) => {
    return (
        <button ref={ref} className={cx("flex items-center justify-center w-[30px] h-[30px] p-0", className)} {...rest}>
            {children}
        </button>
    )
})
