export function Progress({ current, total }: { current: number; total: number }) {
    const progressPercent = total > 0 ? ((current / total) * 100).toFixed(1).replace(".0", "") : "0"
    const formatter = new Intl.NumberFormat("en-US")
    const formattedCurrent = formatter.format(current)
    const formattedTotal = formatter.format(total)

    return (
        <main>
            <div className="progress-bar-text">
                <span>{progressPercent}%</span>
                <span>
                    {formattedCurrent} / {formattedTotal}
                </span>
            </div>
            <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <p>
                {current > 0 ? "Syncing" : "Loading data"}… please keep the plugin open until the process is complete.
            </p>
        </main>
    )
}
