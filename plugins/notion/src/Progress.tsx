const LOADING_PHASE_MAX = 20

export function Progress({ current, total }: { current: number; total: number }) {
    const percent = Math.round(getProgressPercent(current, total))
    const formatter = new Intl.NumberFormat("en-US")
    const formattedCurrent = formatter.format(current)
    const formattedTotal = formatter.format(total)

    return (
        <main>
            <div className="progress-bar-text">
                <span className="progress-bar-percent">{percent}%</span>
                <span>
                    {formattedCurrent} / {formattedTotal}
                </span>
            </div>
            <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
            </div>
            <p>
                {current > 0 ? "Syncing" : "Loading data"}… please keep the plugin open until the process is complete.
            </p>
        </main>
    )
}

function getProgressPercent(current: number, total: number): number {
    if (current > 0 && total > 0) {
        // Processing phase: base 20%, remaining 80% from current/total
        return LOADING_PHASE_MAX + 80 * (current / total)
    }
    if (total > 0) {
        // Loading phase: 0–20% with total/(total+k) so we approach but never reach 20%
        const k = 150
        return LOADING_PHASE_MAX * (total / (total + k))
    }
    return 0
}
