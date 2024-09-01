import React from "react"
import cx from "classnames"
import { CaretLeftIcon } from "./Icons"

const PageDivider = () => (
    <div className="px-15">
        <hr />
    </div>
)

const Title = ({ title }: { title: string }) => (
    <React.Fragment>
        <PageDivider />
        <div className="flex gap-[5px]">
            <div onClick={history.back} className="flex items-center pl-15 cursor-pointer">
                <CaretLeftIcon />
            </div>
            <div className="py-15">
                <h6>{title}</h6>
            </div>
        </div>
    </React.Fragment>
)

interface Props {
    children: React.ReactNode
    title?: string
    className?: string
}

export const PluginPage = ({ children, title, className }: Props) => (
    <div className={cx("flex flex-col h-fit w-[260px]", className)}>
        {title && <Title title={title} />}
        <PageDivider />
        <div className="col-lg p-15">{children}</div>
    </div>
)
