import cx from "classnames"
import { useLocation } from "wouter"

interface Props {
    icon: React.ReactElement
    title: string
    to: string
    className?: string
    onClick?: () => void
}

export const MenuOption = ({ icon, title, to, className, onClick }: Props) => {
    const [, navigate] = useLocation()

    return (
        <button
            className={cx(
                "h-[110px] w-full col items-center justify-center text-secondary rounded-[10px] tile-border",
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
