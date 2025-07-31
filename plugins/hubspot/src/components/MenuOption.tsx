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
            className={cx("h-[110px] w-full tile col items-center justify-center rounded-md", className)}
            onClick={() => {
                if (onClick) {
                    onClick()
                } else {
                    navigate(to)
                }
            }}
        >
            {icon}
            <p className="font-semibold text-tertiary">{title}</p>
        </button>
    )
}
