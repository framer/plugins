import type { SVGProps } from "react"

export function IconComponent(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} fill="none" {...props}>
            <path
                fill="currentColor"
                d="M4.4.6C5 0 6 0 6.6.6L8.2 2 5.5 4.8 2.8 2zM2.1 8.2L.6 6.6C0 6 0 5 .6 4.4L2 2.8l2.7 2.7zm8.3-3.8c.6.6.6 1.6 0 2.2L9 8.2 6.2 5.5 9 2.8zm-3.8 6c-.6.6-1.6.6-2.2 0L2.8 9l2.7-2.7L8.2 9z"
            />
        </svg>
    )
}
