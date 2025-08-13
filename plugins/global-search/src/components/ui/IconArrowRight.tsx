import type { SVGProps } from "react"

export function IconArrowRight(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={5} height={6} {...props}>
            <path fill="currentColor" d="M1.5 1A.3.3 0 001 1v4c0 .2.3.4.5.2l2.2-1.9c.2 0 .2-.3 0-.4z" />
        </svg>
    )
}
