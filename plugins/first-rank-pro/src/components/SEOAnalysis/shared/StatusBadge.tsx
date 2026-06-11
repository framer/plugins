import { OptimizedIcon, UnoptimizedIcon, WarningIcon } from "../../../assets/icons"
import "../styles.css"

interface StatusBadgeProps {
    status: string
    description: string
}

function getStatusIcon(status: string) {
    switch (status) {
        case "pass":
            return <OptimizedIcon />
        case "fail":
            return <UnoptimizedIcon />
        case "warning":
            return <WarningIcon />
        default:
            return null
    }
}

export function StatusBadge({ status, description }: StatusBadgeProps) {
    return (
        <div className={`status-badge`}>
            <span className={`status-icon`}>{getStatusIcon(status)}</span>
            <span className={`status-text ${status}`}>{description}</span>
        </div>
    )
}
