import { Link, useLocation } from "wouter"
import classNames from "classnames"

interface LinkProps {
    href: string
    children?: React.ReactNode
    className?: string
    // eslint-disable-next-line
    state?: any
}

export const InternalLink = ({ href, children, className, state }: LinkProps) => {
    const [_, navigate] = useLocation()

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault()
        navigate(href, { state })
    }

    return (
        <Link to={href} className={classNames("framer-blue", className)} onClick={handleClick}>
            {children}
        </Link>
    )
}

export const ExternalLink = ({ href, children, className }: LinkProps) => (
    <a href={href} target="_blank" className={classNames("text-salesforce-blue", className)}>
        {children}
    </a>
)
