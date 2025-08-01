import { HighlightedCode } from "./HighlightedCode"

interface CurrentCodeProps {
    code: string
}

/**
 * Code List of the current version, where no diff is shown
 * It shows all lines of the current version, and the one row of line numbers are shown on the left
 */
export function CurrentCode({ code }: CurrentCodeProps) {
    return <HighlightedCode code={code} showLineNumbers className="animate-(--fade-in-animation)" />
}
