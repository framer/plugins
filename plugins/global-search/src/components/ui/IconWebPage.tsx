import { type SVGProps, useMemo } from "react"

export function IconWebPage(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            role="presentation"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M1.75 2.75a2 2 0 0 1 2-2h1a1 1 0 0 1 1 1v2.5a1 1 0 0 0 1 1h2.5a1 1 0 0 1 1 1v3a2 2 0 0 1-2 2h-4.5a2 2 0 0 1-2-2Z"
                fill="currentColor"
                fillOpacity="0.2"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <path
                d="M4.5.75h1.172a2 2 0 0 1 1.414.586l2.578 2.578a2 2 0 0 1 .586 1.414V6.5"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="1.5"
            />
        </svg>
    )
}
