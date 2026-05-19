import { type SVGProps, useMemo } from "react"

export function IconComponent(props: SVGProps<SVGSVGElement>) {
    const isPrerelease = useMemo(() => document.body.getAttribute("data-framer-styles") === "prerelease", [])

    return isPrerelease ? (
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
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} fill="none" {...props}>
            <path
                fill="currentColor"
                d="M4.4.6C5 0 6 0 6.6.6L8.2 2 5.5 4.8 2.8 2zM2.1 8.2L.6 6.6C0 6 0 5 .6 4.4L2 2.8l2.7 2.7zm8.3-3.8c.6.6.6 1.6 0 2.2L9 8.2 6.2 5.5 9 2.8zm-3.8 6c-.6.6-1.6.6-2.2 0L2.8 9l2.7-2.7L8.2 9z"
            />
        </svg>
    )
}
