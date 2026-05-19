import cx from "classnames"
import { motion } from "motion/react"
import React from "react"
import { CaretLeftIcon } from "./Icons"

const PageDivider = () => (
    <div className="px-[15px]">
        <hr />
    </div>
)

interface TitleProps {
    title: string
    animateForward?: boolean
    goBack: () => void
}

const Title = ({ title, animateForward, goBack }: TitleProps) => (
    <React.Fragment>
        <PageDivider />
        <div className="relative flex gap-[5px] items-center justify-center overflow-hidden min-h-10">
            <div
                onClick={goBack}
                className="absolute left-0 flex items-center justify-center h-full w-10 cursor-pointer"
            >
                <CaretLeftIcon />
            </div>
            <h6>{title}</h6>
        </div>
    </React.Fragment>
)

interface Props {
    children: React.ReactNode
    className?: string
    title?: string
    animateForward?: boolean
    showTopDivider?: boolean
    goBack: () => void
}

export const Layout = ({ children, className, title, showTopDivider = true, animateForward, goBack }: Props) => (
    <div className={cx("flex flex-col w-full h-full", className)}>
        {title && <Title title={title} animateForward={animateForward} goBack={goBack} />}
        {showTopDivider && <PageDivider />}
        <div className="col-lg w-full h-full">{children}</div>
    </div>
)
