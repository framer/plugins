import cx from "classnames"
import { motion } from "framer-motion"
import React from "react"
import { CaretLeftIcon } from "./Icons"

const PageDivider = () => (
    <div className="px-15">
        <hr />
    </div>
)

const Title = ({ title, animateForward }: { title: string; animateForward?: boolean }) => (
    <React.Fragment>
        <PageDivider />
        <div className="flex gap-[5px] overflow-hidden">
            <div onClick={history.back} className="flex items-center pl-15 cursor-pointer">
                <CaretLeftIcon />
            </div>
            <motion.div
                className="py-15"
                initial={{ opacity: 0.75, x: animateForward ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                    type: "spring",
                    damping: 20,
                    stiffness: 400,
                    mass: 0.1,
                    velocity: 300,
                    duration: 0.15,
                    delay: 0.17,
                }}
            >
                <h6>{title}</h6>
            </motion.div>
        </div>
    </React.Fragment>
)

interface Props {
    children: React.ReactNode
    animateForward?: boolean
    title?: string
    className?: string
}

export const PluginPage = ({ children, title, className, animateForward }: Props) => (
    <div className={cx("flex flex-col h-fit w-[260px]", className)}>
        {title && <Title title={title} animateForward={animateForward} />}
        <PageDivider />
        <div className="col-lg p-15">{children}</div>
    </div>
)
