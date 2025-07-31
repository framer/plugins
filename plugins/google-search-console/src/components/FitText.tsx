import { Textfit } from "@ataverascrespo/react18-ts-textfit"
import { type ReactNode, useState } from "react"

interface FitTextProps {
    children: ReactNode
}

export default function FitText({ children }: FitTextProps) {
    const [ready, setReady] = useState(false)

    return (
        <div style={{ opacity: ready ? 1 : 0 }}>
            <Textfit
                min={12}
                max={32}
                mode="single"
                onReady={() => {
                    setReady(true)
                }}
            >
                {children}
            </Textfit>
        </div>
    )
}
