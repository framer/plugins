import { animate, motion, useMotionValue, useTransform } from "motion/react"
import { useEffect } from "react"

export function Progress({ current, total }: { current: number; total: number }) {
    const percent = (current / total) * 100
    const formatter = new Intl.NumberFormat("en-US")
    const formattedCurrent = formatter.format(current)
    const formattedTotal = formatter.format(total)

    const animatedValue = useMotionValue(0)

    useEffect(() => {
        void animate(animatedValue, percent, { type: "tween" })
    }, [percent, animatedValue])

    return (
        <main>
            <div className="progress-bar-text">
                <span className="progress-bar-percent">{Math.round(percent)}%</span>
                <span>
                    {formattedCurrent} / {formattedTotal}
                </span>
            </div>
            <div className="progress-bar">
                <motion.div
                    className="progress-bar-fill"
                    style={{
                        width: useTransform(() => `${animatedValue.get()}%`),
                    }}
                />
            </div>
            <p>Exporting… please keep the plugin open until the process is complete.</p>
        </main>
    )
}
