import { useMemo } from "react"
import type { IndexNodeType } from "../search/types"

interface Props {
    type: IndexNodeType
    isBreakpoint: boolean
}

export default function LayerIcon({ type, isBreakpoint }: Props) {
    const isPrerelease = useMemo(() => document.body.getAttribute("data-framer-styles") === "prerelease", [])

    let icon = null

    if (isPrerelease) {
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
    } else {
        switch (type) {
            case "TextNode":
                icon = (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        role="presentation"
                        width="12"
                        height="12"
                        className="text-icon"
                    >
                        <path
                            d="M6 3.5v6M2.25 2.5h7.5"
                            fill="transparent"
                            strokeWidth="2"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeMiterlimit="10"
                        />
                    </svg>
                )
                break

            case "FrameNode":
                icon = isBreakpoint ? (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        fill="none"
                        role="presentation"
                        className="frame-icon"
                    >
                        <path
                            fill="currentColor"
                            d="M1 3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 1 4Z"
                        />
                        <path
                            fill="currentColor"
                            fillOpacity="0.4"
                            d="M1 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 .5.5v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2Z"
                        />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11" className="frame-icon">
                        <path
                            d="M 1 2.5 C 1 1.672 1.672 1 2.5 1 L 8.5 1 C 9.328 1 10 1.672 10 2.5 L 10 8.5 C 10 9.328 9.328 10 8.5 10 L 2.5 10 C 1.672 10 1 9.328 1 8.5 Z"
                            fill="currentColor"
                        />
                    </svg>
                )
                break

            case "ComponentInstanceNode":
                icon = (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="11"
                        height="11"
                        viewBox="0 0 11 11"
                        className="component-icon"
                    >
                        <path
                            d="M4.44.55a1.5 1.5 0 0 1 2.12 0l1.592 1.591L5.5 4.793 2.848 2.14ZM2.14 8.152.551 6.56a1.5 1.5 0 0 1 0-2.122l1.59-1.59L4.793 5.5Zm8.309-3.713a1.5 1.5 0 0 1 0 2.122L8.859 8.15 6.207 5.5 8.86 2.848Zm-3.89 6.01a1.5 1.5 0 0 1-2.12 0L2.847 8.86 5.5 6.207 8.152 8.86Z"
                            fill="currentColor"
                        />
                    </svg>
                )
                break

            default:
                icon = null
        }
    }

    return <div className="icon">{icon}</div>
}
