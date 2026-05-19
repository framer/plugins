import { useMemo } from "react"

export function CollectionIcon() {
    const isPrerelease = useMemo(() => document.body.getAttribute("data-framer-styles") === "prerelease", [])

    return isPrerelease ? (
        <svg
            role="presentation"
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <path
                fill="currentColor"
                fillOpacity="0.2"
                stroke="currentColor"
                strokeWidth="1.5"
                d="M1.5 8.75v-5.5C1.5 1.869 3.515.75 6 .75s4.5 1.119 4.5 2.5v5.5m0 0c0 1.381-2.015 2.5-4.5 2.5s-4.5-1.119-4.5-2.5"
            />
            <path
                fill="none"
                stroke="currentColor"
                d="M10.25 3.25c0 1.105-1.903 2-4.25 2s-4.25-.895-4.25-2M10.25 6c0 1.105-1.903 2-4.25 2s-4.25-.895-4.25-2"
            />
        </svg>
    ) : (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={12}
            height={12}
            viewBox="0 0 12 12"
            fill="none"
            role="presentation"
            aria-hidden="true"
        >
            <path
                d="M 6 0.5 C 8.761 0.5 11 1.619 11 3 C 11 4.381 8.761 5.5 6 5.5 C 3.239 5.5 1 4.381 1 3 C 1 1.619 3.239 0.5 6 0.5 Z"
                fill="currentColor"
            />
            <path
                d="M 11 6 C 11 7.381 8.761 8.5 6 8.5 C 3.239 8.5 1 7.381 1 6 C 1 5.711 1.098 5.433 1.278 5.175 C 2.377 5.991 4.084 6.515 6 6.515 C 7.916 6.515 9.623 5.991 10.722 5.175 C 10.902 5.433 11 5.711 11 6 Z"
                fill="currentColor"
            />
            <path
                d="M 11 9 C 11 10.381 8.761 11.5 6 11.5 C 3.239 11.5 1 10.381 1 9 C 1 8.711 1.098 8.433 1.278 8.175 C 2.377 8.991 4.084 9.515 6 9.515 C 7.916 9.515 9.623 8.991 10.722 8.175 C 10.902 8.433 11 8.711 11 9 Z"
                fill="currentColor"
            />
        </svg>
    )
}
