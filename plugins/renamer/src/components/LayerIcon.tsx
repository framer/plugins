import type { IndexNodeType } from "../search/types"

interface Props {
    type: IndexNodeType
    isBreakpoint: boolean
}

export default function LayerIcon({ type, isBreakpoint }: Props) {
    let icon = null

    switch (type) {
        case "TextNode":
            icon = (
                <svg
                    role="presentation"
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    fill="none"
                    className="text-icon"
                >
                    <g
                        fill="transparent"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeMiterlimit="10"
                        strokeWidth="1.5"
                    >
                        <path d="M6.25 2.25V10M2 2.25h8.5" />
                    </g>
                </svg>
            )
            break
        case "FrameNode":
            icon = isBreakpoint ? (
                <svg
                    role="presentation"
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    fill="none"
                    className="frame-icon"
                >
                    <defs>
                        <clipPath id="breakpoint-clip-path">
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
                        clipPath="url(#breakpoint-clip-path)"
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
                <svg
                    role="presentation"
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    fill="none"
                    className="frame-icon"
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
                </svg>
            )
            break

        case "ComponentInstanceNode":
            icon = (
                <svg
                    role="presentation"
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                    className="component-icon"
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
            )
            break

        default:
            icon = null
    }

    return <div className="icon">{icon}</div>
}
