import { useEffect } from "react"
import { framer } from "framer-plugin"
import { useLocation } from "wouter"
import cx from "classnames"
import { useAccountQuery, useFormsQuery, useInboxesQuery, useMeetingsQuery, useUserQuery } from "@/api"
import { Logo } from "@/components/Logo"
import { ChartIcon, FormsIcon, PersonIcon, MessageIcon, LightningIcon, MeetingsIcon } from "@/components/Icons"
import { PluginError } from "@/PluginError"

const queryHooks = {
    "/canvas/forms": { hook: useFormsQuery, shouldRefetch: true },
    "/canvas/account": { hook: useAccountQuery, shouldRefetch: false },
    "/canvas/tracking": { hook: useUserQuery, shouldRefetch: true },
    "/canvas/chat": { hook: useInboxesQuery, shouldRefetch: true },
    "/canvas/meetings": { hook: useMeetingsQuery, shouldRefetch: true },
}

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
            onClick={() => (onClick ? onClick() : navigate(to))}
        >
            {icon}
            <p className="font-semibold text-tertiary">{title}</p>
        </button>
    )
}

export default function MenuPage() {
    const [location] = useLocation()

    const queries = Object.fromEntries(
        Object.entries(queryHooks).map(([key, { hook, shouldRefetch }]) => [key, { query: hook(), shouldRefetch }])
    )

    useEffect(() => {
        const pageQuery = queries[location]
        if (pageQuery && pageQuery.shouldRefetch) {
            pageQuery.query.refetch()
        }
    }, [location, queries])

    return (
        <main>
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
                <MenuOption title="Forms" to="/canvas/forms" icon={<FormsIcon />} />
                <MenuOption title="Tracking" to="/canvas/tracking" icon={<ChartIcon />} />
                <MenuOption title="Meetings" to="/canvas/meetings" icon={<MeetingsIcon />} />
                <MenuOption title="Chats" to="/canvas/chat" icon={<MessageIcon />} className="gap-[7px]" />
                <MenuOption
                    title="Events"
                    to="/canvas/events"
                    icon={<LightningIcon />}
                    onClick={() => framer.notify("The events feature will be out soon", { variant: "info" })}
                />
                <MenuOption title="Account" to="/canvas/account" icon={<PersonIcon />} />
            </div>
        </main>
    )
}
