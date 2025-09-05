import type { HTMLAttributes } from "react"

export function IconCode(props: HTMLAttributes<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" {...props}>
            <path
                fill="transparent"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 3 1 6l3 3m4-6 3 3-3 3"
            />
        </svg>
    )
}
