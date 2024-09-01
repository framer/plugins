import { useLocation } from "wouter"
import { Logo } from "../components/Logo"
import { CalendarIcon, ChartIcon, FormsIcon, PersonIcon, MessageIcon, LightningIcon } from "../components/Icons"

const MenuOption = ({
    icon,
    title,
    to,
    disabled = false,
}: {
    icon: React.ReactElement
    title: string
    to: string
    disabled?: boolean
}) => {
    const [, setLocation] = useLocation()

    return (
        <button
            className="h-[110px] w-full tile col items-center justify-center rounded-md"
            onClick={() => setLocation(to)}
            disabled={disabled}
        >
            {icon}
            <p className="font-semibold">{title}</p>
        </button>
    )
}

export function MenuPage() {
    return (
        <div className="col-lg">
            <div className="col items-center py-15">
                <Logo />
                <h6>Welcome to HubSpot</h6>
                <p className="text-center text-tertiary">
                    View your forms, monitor your site traffic, embed widgets and more.
                </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
                <MenuOption title="Forms" to="/forms" icon={<FormsIcon />} />
                <MenuOption title="Tracking" to="/tracking" icon={<ChartIcon />} />
                <MenuOption title="Widgets" to="/widgets" icon={<CalendarIcon />} />
                <MenuOption title="Chatflows" to="/chat" icon={<MessageIcon />} />
                <MenuOption title="Events" to="/events" icon={<LightningIcon />} disabled />
                <MenuOption title="Account" to="/account" icon={<PersonIcon />} />
            </div>
        </div>
    )
}
