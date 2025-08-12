import type { SVGProps } from "react"

export function IconEllipsis(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={13} height={3} fill="none" overflow="visible" {...props}>
            <path
                fill="currentColor"
                d="M1.5 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm5 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm5 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"
            />
        </svg>
    )
}
