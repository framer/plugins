import cx from "classnames"
import React from "react"
import { CaretLeftIcon } from "./Icons"

const PageDivider = () => (
    <div className="px-[15px]">
        <hr />
    </div>
)

interface TitleProps {
    title: string
    goBack: () => void
}

const Title = ({ title, goBack }: TitleProps) => (
    <React.Fragment>
        <PageDivider />
        <div className="relative flex gap-[5px] items-center justify-center overflow-hidden min-h-[48px]">
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
    showTopDivider?: boolean
    goBack: () => void
}

export const Layout = ({ children, className, title, showTopDivider = true, goBack }: Props) => (
    <div className={cx("flex flex-col w-full h-full", className)}>
        {title && <Title title={title} goBack={goBack} />}
        {showTopDivider && <PageDivider />}
        <div className="col-lg w-full h-full">{children}</div>
    </div>
)
