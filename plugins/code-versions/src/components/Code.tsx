import { CurrentCode } from "./CurrentCode"
import { FileDiff } from "./FileDiff"

interface CodeProps {
    original: string
    revised: string
    isCurrentVersion: boolean
}

export function Code({ original, revised, isCurrentVersion }: CodeProps) {
    if (isCurrentVersion || original === revised) {
        return <CurrentCode code={original} />
    }
    return <FileDiff original={original} revised={revised} />
}
