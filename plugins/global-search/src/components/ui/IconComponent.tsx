import { type SVGProps } from "react"

export function IconComponent(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            role="presentation"
            {...props}
        >
            <path
                fill="currentColor"
                fillOpacity="0.2"
                stroke="currentColor"
                strokeWidth="1.5"
                d="M4.586 1.354a2 2 0 0 1 2.828 0l3.232 3.232a2 2 0 0 1 0 2.828l-3.232 3.232a2 2 0 0 1-2.828 0L1.354 7.414a2 2 0 0 1 0-2.828Z"
            />
            <path fill="none" stroke="currentColor" d="m3 3 6 6M9 3 3 9" />
        </svg>
    )
}
