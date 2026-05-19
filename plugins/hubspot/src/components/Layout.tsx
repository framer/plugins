import cx from "classnames"
import { CaretLeftIcon } from "./Icons"

interface Props {
    children: React.ReactNode
    className?: string
    title?: string
    goBack: () => void
}

export const Layout = ({ children, className, title, goBack }: Props) => (
    <div className={cx("flex flex-col w-full h-full", className)}>
        {title && (
            <>
                <div className="relative flex gap-[5px] items-center justify-center overflow-hidden min-h-[48px]">
                    <div
                        onClick={goBack}
                        className="absolute left-0 flex items-center justify-center h-full w-10 cursor-pointer"
                    >
                        <CaretLeftIcon />
                    </div>
                    <h6>{title}</h6>
                </div>
                <div className="px-[15px]">
                    <hr />
                </div>
            </>
        )}
        <div className="col-lg w-full h-full">{children}</div>
    </div>
)
