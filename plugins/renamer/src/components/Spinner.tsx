import "./Spinner.css"

interface Props {
    type: "dashed" | "solid"
}

export default function Spinner({ type }: Props) {
    return (
        <div title="Indexing...">
            {type === "dashed" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <g>
                        <rect x="11" y="1" width="2" height="5" opacity=".14" fill="currentColor" />
                        <rect
                            x="11"
                            y="1"
                            width="2"
                            height="5"
                            transform="rotate(30 12 12)"
                            opacity=".29"
                            fill="currentColor"
                        />
                        <rect
                            x="11"
                            y="1"
                            width="2"
                            height="5"
                            transform="rotate(60 12 12)"
                            opacity=".43"
                            fill="currentColor"
                        />
                        <rect
                            x="11"
                            y="1"
                            width="2"
                            height="5"
                            transform="rotate(90 12 12)"
                            opacity=".57"
                            fill="currentColor"
                        />
                        <rect
                            x="11"
                            y="1"
                            width="2"
                            height="5"
                            transform="rotate(120 12 12)"
                            opacity=".71"
                            fill="currentColor"
                        />
                        <rect
                            x="11"
                            y="1"
                            width="2"
                            height="5"
                            transform="rotate(150 12 12)"
                            opacity=".86"
                            fill="currentColor"
                        />
                        <rect x="11" y="1" width="2" height="5" transform="rotate(180 12 12)" fill="currentColor" />
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            calcMode="discrete"
                            dur="0.75s"
                            values="0 12 12;30 12 12;60 12 12;90 12 12;120 12 12;150 12 12;180 12 12;210 12 12;240 12 12;270 12 12;300 12 12;330 12 12;360 12 12"
                            repeatCount="indefinite"
                        />
                    </g>
                </svg>
            ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path
                        fill="currentColor"
                        d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"
                    >
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            dur="0.75s"
                            values="0 12 12;360 12 12"
                            repeatCount="indefinite"
                        />
                    </path>
                </svg>
            )}
        </div>
    )
}
