import cx from "classnames"

export const FormsIcon = () => (
    <svg role="presentation" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="16" height="16" fill="none">
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
)

export const MeetingsIcon = () => (
    <svg role="presentation" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="16" height="16" fill="none">
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
)

export const ChartIcon = () => (
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
)

export const PersonIcon = () => (
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
)

export const MessageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="6 6 18 18" fill="none" role="presentation">
        <path
            d="M15 7a8 8 0 0 1 0 16H9a2 2 0 0 1-2-2v-6a8 8 0 0 1 8-8Z"
            fill="currentColor"
            fillOpacity="0.2"
            stroke="currentColor"
            strokeWidth="2"
        />
    </svg>
)

export const LightningIcon = () => (
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
)

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

export const DatabaseIcon = () => (
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
)

export const IconChevron = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="5"
        height="8"
        className="fill-transparent stroke-[#999] stroke-[1.5] stroke-round stroke-linejoin-round"
    >
        <path d="M 1 1 L 4 4 L 1 7"></path>
    </svg>
)
