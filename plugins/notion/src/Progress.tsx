import { framer } from "framer-plugin"
import { animate, motion, useMotionValue, useTransform } from "motion/react"
import { useEffect } from "react"

const LOADING_PHASE_MAX = 20
const LOADING_PHASE_K = 150

export function Progress({
    current,
    total,
    contentFieldEnabled,
    hasFinishedLoading,
}: {
    current: number
    total: number
    /** When false, loading phase spans 0–100% (no per-page content fetch). */
    contentFieldEnabled: boolean
    /** When true, database items loading phase is complete. */
    hasFinishedLoading: boolean
}) {
    const percent = getProgressPercent(current, total, contentFieldEnabled, hasFinishedLoading)
    const formatter = new Intl.NumberFormat("en-US")
    const formattedCurrent = formatter.format(current)
    const formattedTotal = formatter.format(total)

    const animatedValue = useMotionValue(0)

    useEffect(() => {
        // Clear menu while syncing
        void framer.setMenu([])
    }, [])

    useEffect(() => {
        void animate(animatedValue, percent, { type: "tween" })
    }, [percent, animatedValue])

    return (
        <main>
            <div className="progress-bar-text">
                <span className="progress-bar-percent">{percent.toFixed(1).replace(".0", "")}%</span>
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
            <p>
                {current > 0 ? "Syncing" : "Loading data"}… please keep the plugin open until the process is complete.
            </p>
        </main>
    )
}

function getProgressPercent(
    current: number,
    total: number,
    contentFieldEnabled: boolean,
    hasFinishedLoading: boolean
): number {
    // Content field is enabled, so we have two loading phases: database items and page content.
    if (total > 0 && contentFieldEnabled) {
        if (current > 0) {
            // Processing phase: base 20%, remaining 80% from current/total
            return LOADING_PHASE_MAX + 80 * (current / total)
        } else if (hasFinishedLoading) {
            // All items have been loaded, show 20%
            return LOADING_PHASE_MAX
        }
        // Loading phase: 0–20% with total/(total+k) so we approach but never reach 20%
        return LOADING_PHASE_MAX * (total / (total + LOADING_PHASE_K))
    }

    // Content field is disabled, so only database items need to be loaded.
    if (total > 0 && !contentFieldEnabled) {
        if (hasFinishedLoading) {
            // All items have been loaded, show 100%
            return 100
        }
        // Loading phase: 0–100% with total/(total+k)
        return 100 * (total / (total + LOADING_PHASE_K))
    }

    return 0
}
