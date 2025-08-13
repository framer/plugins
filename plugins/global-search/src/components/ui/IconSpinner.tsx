import type { SVGProps } from "react"

export function IconSpinner(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} fill="none" overflow="visible" {...props}>
            <g fill="currentColor" opacity={0.5}>
                <path d="M6 0a6 6 0 110 12A6 6 0 016 0zM2 6a4 4 0 108 0 4 4 0 00-8 0z" opacity={0.4} />
                <path d="M0 6a6 6 0 016-6 1 1 0 010 2 4 4 0 000 8 1 1 0 010 2 6 6 0 01-6-6z" />
            </g>
        </svg>
    )
}
