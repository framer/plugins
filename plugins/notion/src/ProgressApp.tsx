import { useEffect, useState } from "react"
import { type SyncProgress } from "./data"
import { Progress } from "./Progress"
import { showProgressUI } from "./ui"

interface ProgressAppProps {
    onProgressReady: (setProgress: (progress: SyncProgress) => void) => void
}

export function ProgressApp({ onProgressReady }: ProgressAppProps) {
    const [progress, setProgress] = useState<SyncProgress>({ current: 0, total: 0 })

    useEffect(() => {
        void showProgressUI()
    }, [])

    useEffect(() => {
        onProgressReady(setProgress)
    }, [onProgressReady])

    return <Progress current={progress.current} total={progress.total} />
}
