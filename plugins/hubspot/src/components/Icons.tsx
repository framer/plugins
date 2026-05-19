import cx from "classnames"
import { useIsPrerelease } from "../utils"

export const FormsIcon = () => {
    const isPrerelease = useIsPrerelease()

    return isPrerelease ? (
        <svg
            role="presentation"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 12 12"
            width="16"
            height="16"
            fill="none"
        >
            <path
                fill="currentColor"
                fillOpacity="0.2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M1.25 3.25a2 2 0 0 1 2-2h5.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-5.5a2 2 0 0 1-2-2Z"
            />
            <path
                fill="transparent"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 4.5h3M4.5 7.5h3"
            />
        </svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
            <path
                d="M 0 4 C 0 1.791 1.791 0 4 0 L 14 0 C 16.209 0 18 1.791 18 4 L 18 14 C 18 16.209 16.209 18 14 18 L 4 18 C 1.791 18 0 16.209 0 14 Z M 4 9 C 4 9.552 4.448 10 5 10 L 13 10 C 13.552 10 14 9.552 14 9 C 14 8.448 13.552 8 13 8 L 5 8 C 4.448 8 4 8.448 4 9 Z M 6 5 C 6 5.552 6.448 6 7 6 L 11 6 C 11.552 6 12 5.552 12 5 C 12 4.448 11.552 4 11 4 L 7 4 C 6.448 4 6 4.448 6 5 Z M 6 13 C 6 13.552 6.448 14 7 14 L 11 14 C 11.552 14 12 13.552 12 13 C 12 12.448 11.552 12 11 12 L 7 12 C 6.448 12 6 12.448 6 13 Z"
                fill="#999999"
            ></path>
        </svg>
    )
}

export const MeetingsIcon = () => {
    const isPrerelease = useIsPrerelease()

    return isPrerelease ? (
        <svg
            role="presentation"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 12 12"
            width="16"
            height="16"
            fill="none"
        >
            <defs>
                <clipPath id="meetings-icon-clip-path">
                    <path d="M.5 3.5a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3Z"></path>
                </clipPath>
            </defs>
            <path
                d="M.5 3.5a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3Z"
                fill="transparent"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                clipPath="url(#meetings-icon-clip-path)"
            />
            <path
                fill="currentColor"
                fillOpacity="0.2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 1.5H2.5l-1 1v2H11v-1Z"
            />
        </svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
            <path
                d="M 0 9.5 C 0 8.395 0.895 7.5 2 7.5 L 16 7.5 C 17.105 7.5 18 8.395 18 9.5 L 18 14 C 18 16.209 16.209 18 14 18 L 4 18 C 1.791 18 0 16.209 0 14 Z M 0 4 C 0 1.791 1.791 0 4 0 L 14 0 C 16.209 0 18 1.791 18 4 L 18 4.5 C 18 5.605 17.105 6.5 16 6.5 L 2 6.5 C 0.895 6.5 0 5.605 0 4.5 Z"
                fill="#999999"
            ></path>
        </svg>
    )
}

export const ChartIcon = () => {
    const isPrerelease = useIsPrerelease()

    return isPrerelease ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="4 4 12 12" fill="none">
            <path
                fill="transparent"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M8.25 8.5v6M5.25 12v2.5M11.25 5.5v9M14.25 10.5v4"
            />
        </svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
            <path
                d="M 0 4 C 0 1.791 1.791 0 4 0 L 14 0 C 16.209 0 18 1.791 18 4 L 18 14 C 18 16.209 16.209 18 14 18 L 4 18 C 1.791 18 0 16.209 0 14 Z M 4 13 C 4 13.552 4.448 14 5 14 C 5.552 14 6 13.552 6 13 L 6 11 C 6 10.448 5.552 10 5 10 C 4.448 10 4 10.448 4 11 Z M 8 13 C 8 13.552 8.448 14 9 14 C 9.552 14 10 13.552 10 13 L 10 8 C 10 7.448 9.552 7 9 7 C 8.448 7 8 7.448 8 8 Z M 12 13 C 12 13.552 12.448 14 13 14 C 13.552 14 14 13.552 14 13 L 14 5 C 14 4.448 13.552 4 13 4 C 12.448 4 12 4.448 12 5 Z"
                fill="#999999"
            ></path>
        </svg>
    )
}

export const PersonIcon = () => {
    const isPrerelease = useIsPrerelease()

    return isPrerelease ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none">
            <path
                d="M 3 14.833 L 3.176 14.481 C 4.09 12.654 5.957 11.5 8 11.5 L 8 11.5 C 10.043 11.5 11.91 12.654 12.824 14.481 L 13 14.833"
                fill="transparent"
                strokeWidth="2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M 8 2 C 9.657 2 11 3.343 11 5 C 11 6.657 9.657 8 8 8 C 6.343 8 5 6.657 5 5 C 5 3.343 6.343 2 8 2 Z"
                fill="currentColor"
                fillOpacity="0.2"
                strokeWidth="2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
            <path
                d="M 0 4 C 0 1.791 1.791 0 4 0 L 14 0 C 16.209 0 18 1.791 18 4 L 18 14 C 18 16.209 16.209 18 14 18 L 4 18 C 1.791 18 0 16.209 0 14 Z M 6.5 6.5 C 6.5 7.881 7.619 9 9 9 C 10.381 9 11.5 7.881 11.5 6.5 C 11.5 5.119 10.381 4 9 4 C 7.619 4 6.5 5.119 6.5 6.5 Z M 5.109 13.125 C 5.051 13.59 5.414 14 5.882 14 L 12.118 14 C 12.586 14 12.949 13.59 12.891 13.125 C 12.667 11.34 11.15 10 9.351 10 L 8.649 10 C 6.85 10 5.333 11.34 5.109 13.125 Z"
                fill="#999999"
            ></path>
        </svg>
    )
}

export const MessageIcon = () => {
    const isPrerelease = useIsPrerelease()

    return isPrerelease ? (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="6 6 18 18"
            fill="none"
            role="presentation"
        >
            <path
                d="M15 7a8 8 0 0 1 0 16H9a2 2 0 0 1-2-2v-6a8 8 0 0 1 8-8Z"
                fill="currentColor"
                fillOpacity="0.2"
                stroke="currentColor"
                strokeWidth="2"
            />
        </svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="21">
            <path
                d="M 0 4 C 0 1.791 1.791 0 4 0 L 14 0 C 16.209 0 18 1.791 18 4 L 18 14 C 18 16.209 16.209 18 14 18 L 4 18 C 1.791 18 0 16.209 0 14 Z M 3 9 C 3 9.828 3.672 10.5 4.5 10.5 C 5.328 10.5 6 9.828 6 9 C 6 8.172 5.328 7.5 4.5 7.5 C 3.672 7.5 3 8.172 3 9 Z M 7.5 9 C 7.5 9.828 8.172 10.5 9 10.5 C 9.828 10.5 10.5 9.828 10.5 9 C 10.5 8.172 9.828 7.5 9 7.5 C 8.172 7.5 7.5 8.172 7.5 9 Z M 12 9 C 12 9.828 12.672 10.5 13.5 10.5 C 14.328 10.5 15 9.828 15 9 C 15 8.172 14.328 7.5 13.5 7.5 C 12.672 7.5 12 8.172 12 9 Z"
                fill="#999999"
            ></path>
            <path
                d="M 4 18 L 14 18 L 12.586 18 C 11.736 18 10.925 18.361 10.356 18.993 L 9.563 19.875 C 9.262 20.209 8.738 20.209 8.438 19.875 L 7.644 18.993 C 7.075 18.361 6.264 18 5.414 18 Z"
                fill="#999999"
            ></path>
        </svg>
    )
}

export const LightningIcon = () => {
    const isPrerelease = useIsPrerelease()

    return isPrerelease ? (
        <svg
            role="presentation"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="1 1 14 14"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <path
                fill="currentColor"
                fillOpacity="0.2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M6.711 2.354c.408-.764 1.569-.427 1.504.436L8 5.65h4.255a.75.75 0 0 1 .663 1.101l-3.63 6.867c-.405.767-1.569.432-1.505-.433L8 10.25H3.75a.75.75 0 0 1-.662-1.103Z"
            />
        </svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
            <path
                d="M 0 4 C 0 1.791 1.791 0 4 0 L 14 0 C 16.209 0 18 1.791 18 4 L 18 14 C 18 16.209 16.209 18 14 18 L 4 18 C 1.791 18 0 16.209 0 14 Z M 5.021 10.099 C 4.79 10.499 5.078 11 5.541 11 L 8.401 11 C 8.713 11 8.949 11.283 8.893 11.589 L 8.545 13.5 C 8.439 14.086 9.229 14.377 9.528 13.861 L 12.979 7.901 C 13.21 7.501 12.922 7 12.459 7 L 9.599 7 C 9.287 7 9.051 6.717 9.107 6.411 L 9.455 4.5 C 9.561 3.914 8.771 3.623 8.472 4.139 Z"
                fill="#999999"
            ></path>
        </svg>
    )
}

export const CaretLeftIcon = () => (
    <svg role="presentation" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none">
        <path
            d="M 5.25 2.25 L 1.75 6 L 5.25 9.75"
            fill="transparent"
            strokeWidth="1.5"
            stroke="#999"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray=""
        ></path>
    </svg>
)

export const DatabaseIcon = () => {
    const isPrerelease = useIsPrerelease()

    return isPrerelease ? (
        <svg
            role="presentation"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
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
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
            <path
                d="M 0 4 C 0 1.791 1.791 0 4 0 L 14 0 C 16.209 0 18 1.791 18 4 L 18 14 C 18 16.209 16.209 18 14 18 L 4 18 C 1.791 18 0 16.209 0 14 Z M 4.5 5.75 C 4.5 6.993 6.515 8 9 8 C 11.485 8 13.5 6.993 13.5 5.75 C 13.5 4.507 11.485 3.5 9 3.5 C 6.515 3.5 4.5 4.507 4.5 5.75 Z M 13.5 7.1 C 13.5 8.343 11.485 9.35 9 9.35 C 6.515 9.35 4.5 8.343 4.5 7.1 C 4.5 7.1 4.5 8.279 4.5 8.9 C 4.5 10.143 6.515 11.15 9 11.15 C 11.485 11.15 13.5 10.143 13.5 8.9 C 13.5 8.279 13.5 7.1 13.5 7.1 Z M 13.5 10.25 C 13.5 11.493 11.485 12.5 9 12.5 C 6.515 12.5 4.5 11.493 4.5 10.25 C 4.5 10.25 4.5 11.429 4.5 12.05 C 4.5 13.293 6.515 14.3 9 14.3 C 11.485 14.3 13.5 13.293 13.5 12.05 C 13.5 11.429 13.5 10.25 13.5 10.25 Z"
                fill="#888888"
            />
        </svg>
    )
}

export const IconChevron = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="5"
        height="8"
        className={cx("fill-transparent stroke-[#999] stroke-[1.5] stroke-round stroke-linejoin-round", className)}
    >
        <path d="M 1 1 L 4 4 L 1 7"></path>
    </svg>
)
