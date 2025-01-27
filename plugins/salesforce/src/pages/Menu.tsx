import { useLocation } from "wouter"
import classNames from "classnames"
import { Logo } from "../components/Logo"
import { ChartsIcon, MessagesIcon, FormsIcon, GlobeIcon, PersonIcon, SyncIcon } from "../components/Icons"
import { framer } from "framer-plugin"

interface MenuOptionProps {
    icon: React.ReactElement
    title: string
    to: string
    className?: string
    state?: Record<string, string | number>
    onClick?: () => void
}

const MenuOption = ({ icon, title, to, className, state, onClick }: MenuOptionProps) => {
    const [, navigate] = useLocation()

    return (
        <button
            className={classNames("h-[110px] w-full tile col items-center justify-center rounded-md", className)}
            onClick={() => (onClick ? onClick() : navigate(to, { state }))}
        >
            {icon}
            <p className="font-semibold text-tertiary">{title}</p>
        </button>
    )
}

export default function Menu() {
    return (
        <main>
            <div className="col-lg items-center pt-[30px] pb-15">
                <Logo />
                <div className="col items-center">
                    <h6>Welcome to Salesforce</h6>
                    <p className="text-center text-tertiary max-w-[200px]">
                        View forms, monitor site traffic, embed chats, and much more.
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
                <MenuOption
                    title="Web Forms"
                    to="/object-search?redirect=/web-form&requiredFields=createable,updateable"
                    icon={<GlobeIcon />}
                    state={{ title: "Web Forms" }}
                />
                <MenuOption title="MCAE Forms" to="/account-engagement-forms" icon={<FormsIcon />} />
                <MenuOption title="Messaging" to="/messaging" icon={<MessagesIcon />} className="gap-[7px]" />
                <MenuOption title="Tracking" to="/tracking" icon={<ChartsIcon />} />
                <MenuOption
                    title="Sync"
                    to=""
                    icon={<SyncIcon />}
                    onClick={() => framer.notify("Launch the plugin via the CMS to sync objects")}
                />
                <MenuOption title="Account" to="/account" icon={<PersonIcon />} />
            </div>
        </main>
    )
}
