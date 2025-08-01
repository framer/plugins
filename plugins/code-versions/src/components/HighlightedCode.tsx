import { highlightElement } from "prismjs"
import { useEffect, useRef } from "react"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-tsx"
import "prismjs/plugins/line-numbers/prism-line-numbers"
import "./HighlightedCode.css"
import { cn } from "../utils"

interface HighlightedCodeProps {
    code: string
    language?: string
    showLineNumbers?: boolean
    className?: string
}

export function HighlightedCode({ code, language = "tsx", showLineNumbers = false, className }: HighlightedCodeProps) {
    const codeRef = useRef<HTMLElement>(null)

    useEffect(() => {
        if (!codeRef.current) return

        highlightElement(codeRef.current)
    }, [code])

    return (
        <div className={cn("highlighted-code", showLineNumbers && "line-numbers", className)}>
            <pre className="font-mono text-code">
                <code ref={codeRef} className={`language-${language}`}>
                    {code}
                </code>
            </pre>
        </div>
    )
}
