import { highlightElement } from "prismjs"
import { useEffect, useRef } from "react"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-tsx"
import "prismjs/plugins/line-numbers/prism-line-numbers"
import "./CurrentCode.css"
import { cn } from "../utils"
import { fadeInAnimationClassName } from "../utils/shared-styles"

interface CurrentCodeProps {
    code: string
}

/**
 * Code List of the current version, where no diff is shown
 * It shows all lines of the current version, and the one row of line numbers are shown on the left
 */
export default function CurrentCode({ code }: CurrentCodeProps) {
    const codeRef = useRef<HTMLElement>(null)

    useEffect(() => {
        if (!codeRef.current) return

        highlightElement(codeRef.current)
    }, [code])

    return (
        <div className={cn("current-code line-numbers", fadeInAnimationClassName)}>
            <pre className="font-mono text-code-size">
                <code ref={codeRef} className="language-tsx">
                    {code}
                </code>
            </pre>
        </div>
    )
}
