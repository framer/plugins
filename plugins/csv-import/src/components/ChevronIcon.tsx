interface ChevronIconProps {
    opacity?: number
}

export function ChevronIcon({ opacity = 1 }: ChevronIconProps) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" fill="none" style={{ opacity }}>
            <path
                fill="transparent"
                stroke="#999"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="m2.5 7 3-3-3-3"
            />
        </svg>
    )
}
