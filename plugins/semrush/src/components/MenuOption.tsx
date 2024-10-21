import { useLocation } from "wouter"

export const MenuOption = ({
    children,
    title,
    to,
    onClick,
}: {
    children: React.ReactNode
    title: string
    to: string
    onClick?: () => void
}) => {
    const [, setLocation] = useLocation()

    return (
        <div
            className="h-[110px] w-[110px] col items-center justify-center bg-tertiary rounded-md cursor-pointer"
            onClick={() => {
                setLocation(to)
                onClick?.()
            }}
        >
            {children}
            <p className="font-semibold">{title}</p>
        </div>
    )
}
