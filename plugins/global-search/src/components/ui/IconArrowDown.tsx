import type { SVGProps } from "react"

export function IconArrowDown(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="6"
            height="6"
            viewBox="0 0 6 6"
            fill="none"
            role="presentation"
            aria-hidden="true"
            {...props}
        >
            <path
                fill="transparent"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.25"
                d="M 0.86 2.1 L 2.647 3.891 C 2.842 4.087 3.158 4.087 3.354 3.892 L 5.15 2.1"
            />
        </svg>
    )
}
