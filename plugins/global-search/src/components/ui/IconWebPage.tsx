import { type SVGProps, useMemo } from "react"

export function IconWebPage(props: SVGProps<SVGSVGElement>) {
    const isPrerelease = useMemo(() => document.body.getAttribute("data-framer-styles") === "prerelease", [])

    return isPrerelease ? (
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
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width={10} height={12} fill="none" overflow="visible" {...props}>
            <path
                fill="currentColor"
                d="M0 2.5C0 1.1 1.1 0 2.5 0H4c.6 0 1 .4 1 1v2c0 1.1.9 2 2 2h2c.6 0 1 .4 1 1v3.5c0 1.4-1.1 2.5-2.5 2.5h-5A2.5 2.5 0 010 9.5zm6.4-2a.3.3 0 00-.4.1V3c0 .6.4 1 1 1h2.4c.2 0 .3-.3.2-.4z"
            />
        </svg>
    )
}
