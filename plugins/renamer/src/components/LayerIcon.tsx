import type { IndexNodeType } from "../search/types"

interface Props {
    type: IndexNodeType
}

export default function LayerIcon({ type }: Props) {
    const width = 12
    const height = 12

    let icon = null

    switch (type) {
        case "TextNode":
            icon = (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" className="text-icon">
                    <path
                        d="M 5.5 4 L 5.5 8.5 M 2.5 3 L 8.5 3"
                        fill="transparent"
                        strokeWidth="2"
                        stroke="currentColor"
                        strokeLinecap="round"
                    />
                </svg>
            )
            break

        case "FrameNode":
            icon = (
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

        case "VectorSetItemNode":
            icon = (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11" className="vector-set-item-icon">
                    <path
                        d="M 4.851 1.121 C 5.14 0.622 5.86 0.622 6.149 1.121 L 10.348 8.374 C 10.638 8.874 10.277 9.5 9.699 9.5 L 1.301 9.5 C 0.723 9.5 0.362 8.874 0.652 8.374 Z"
                        fill="currentColor"
                    ></path>
                </svg>
            )
            break

        default:
            icon = null
    }

    return (
        <div className="icon" style={{ width, height }}>
            {icon}
        </div>
    )
}
