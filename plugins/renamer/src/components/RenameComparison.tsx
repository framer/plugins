interface Props {
    selected: boolean
    before: string
    after: string
    children: React.ReactNode
    onClick: () => void
}

export default function RenameComparison({ selected, before, after, children, onClick }: Props) {
    return (
        <button className={`replace-comparison ${after ? "grid" : ""} ${selected ? "selected" : ""}`} onClick={onClick}>
            <div className="before">
                <div className="icon">{children}</div>

                <div className="label">{before}</div>
            </div>

            {after && (
                <>
                    <div className="chevron">
                        <svg width="5px" height="8px" viewBox="0 0 5 8">
                            <g
                                stroke="none"
                                strokeWidth="1"
                                fill="none"
                                fillRule="evenodd"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <g
                                    transform="translate(1, 1)"
                                    fillRule="nonzero"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                >
                                    <polyline id="Path" points="0 6 3 3 0 0" />
                                </g>
                            </g>
                        </svg>
                    </div>

                    <div className="after">
                        <div className="icon">{children}</div>

                        <div className="label">{after}</div>
                    </div>
                </>
            )}
        </button>
    )
}
