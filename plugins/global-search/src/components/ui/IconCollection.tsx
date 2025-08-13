import type { SVGProps } from "react"

export function IconCollection(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={9} height={11.1} fill="none" overflow="visible" {...props}>
            <g fill="currentColor">
                <path d="M4.5 0C7 0 9 1 9 2.3c0 1.3-2 2.3-4.5 2.3S0 3.6 0 2.3C0 1 2 0 4.5 0z" />
                <path d="M9 5.3c0 1.3-2 2.3-4.5 2.3S0 6.6 0 5.3V3.5c0 1.2 2 2.3 4.5 2.3S9 4.8 9 3.5z" />
                <path d="M9 8.8c0 1.3-2 2.3-4.5 2.3S0 10.1 0 8.8V7.1c0 1 2 2.2 4.5 2.2S9 8.3 9 7z" />
            </g>
        </svg>
    )
}
