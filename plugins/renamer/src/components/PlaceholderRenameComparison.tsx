interface Props {
    index: number
    total: number
    width: number
}

export default function PlaceholderRenameComparison({ index, total, width }: Props) {
    return (
        <div className="placeholder-rename-comparison" style={{ animationDelay: `${index / 20}s` }}>
            <div
                className="content"
                style={{
                    width: "12px",
                    opacity: 1 - index / total,
                }}
            />
            <div
                className="content"
                style={{
                    width: `${width}%`,
                    opacity: 1 - index / total,
                }}
            />
        </div>
    )
}
