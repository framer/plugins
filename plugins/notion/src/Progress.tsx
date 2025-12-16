export function Progress({ current, total }: { current: number; total: number }) {
    const progressPercent = total > 0 ? ((current / total) * 100).toFixed(1).replace(".0", "") : "0"

    return (
        <main>
            <div className="progress-bar-text">
                <p>{progressPercent}%</p>
                <p>
                    {current} / {total}
                </p>
            </div>
            <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <p>Syncing... please keep the plugin open until the process is complete.</p>
        </main>
    )
}
