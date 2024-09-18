import { useLocation } from "wouter"
import { Logo } from "../components/Logo"
import { ChartIcon, FormsIcon, PersonIcon, MessageIcon, LightningIcon, WidgetsIcon } from "../components/Icons"
import { framer } from "framer-plugin"
import cx from "classnames"
import { BASE_PATH } from "../router"

const MenuOption = ({
    icon,
    title,
    to,
    className,
    onClick,
}: {
    icon: React.ReactElement
    title: string
    to: string
    className?: string
    onClick?: () => void
}) => {
    const [, navigate] = useLocation()

    return (
        <button
            className={cx("h-[110px] w-full tile col items-center justify-center rounded-md", className)}
            onClick={() => (onClick ? onClick() : navigate(`${BASE_PATH}${to}`))}
        >
            {icon}
            <p className="font-semibold text-tertiary">{title}</p>
        </button>
    )
}

export function MenuPage() {
    return (
        <div className="col-lg">
            <div className="col-lg items-center pt-[30px] pb-15">
                <Logo />
                <div className="col items-center">
                    <h6>Welcome to HubSpot</h6>
                    <p className="text-center text-tertiary max-w-[200px]">
                        View forms, monitor site traffic, embed widgets and much more.
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
                <MenuOption title="Forms" to="/forms" icon={<FormsIcon />} />
                <MenuOption title="Tracking" to="/tracking" icon={<ChartIcon />} />
                <MenuOption title="Widgets" to="/widgets" icon={<WidgetsIcon />} />
                <MenuOption title="Chats" to="/chat" icon={<MessageIcon />} className="gap-[7px]" />
                <MenuOption
                    title="Events"
                    to="/events"
                    icon={<LightningIcon />}
                    onClick={() => framer.notify("The events feature will be out soon", { variant: "info" })}
                />
                <MenuOption title="Account" to="/account" icon={<PersonIcon />} />
            </div>
        </div>
    )
}
