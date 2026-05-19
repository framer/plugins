import cx from "classnames"
import { useLocation } from "wouter"
import { useIsPrerelease } from "../utils"

interface Props {
    icon: React.ReactElement
    title: string
    to: string
    className?: string
    onClick?: () => void
}

export const MenuOption = ({ icon, title, to, className, onClick }: Props) => {
    const [, navigate] = useLocation()
    const isPrerelease = useIsPrerelease()

    return (
        <button
            className={cx(
                "h-[110px] w-full col items-center justify-center",
                isPrerelease ? "text-secondary rounded-[10px] tile-border" : "text-tertiary rounded-md",
                className
            )}
            onClick={() => {
                if (onClick) {
                    onClick()
                } else {
                    navigate(to)
                }
            }}
        >
            {icon}
            <span className="font-semibold">{title}</span>
        </button>
    )
}
