import "./styles.css"

export function ChecklistSkeleton() {
    return (
        <div className="checks-list">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="check-item skeleton">
                    <span className="status-icon skeleton-circle"></span>
                    <span className="check-label skeleton-text"></span>
                </div>
            ))}
        </div>
    )
}

export function DetailPanelSkeleton() {
    return (
        <div className="detail-panel-skeleton">
            <div className="skeleton-title"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
            <div className="skeleton-box"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line medium"></div>
        </div>
    )
}
