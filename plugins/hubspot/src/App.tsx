import { framer } from "framer-plugin"
import { useEffect, useRef, useState } from "react"
import { useDebounceCallback, useResizeObserver } from "usehooks-ts"
import { Router } from "./router"
interface Size {
    width?: number
    height?: number
}

const usePluginResizeObserver = (ref: React.RefObject<HTMLDivElement>) => {
    const [{ width, height }, setSize] = useState<Size>({
        width: 260,
        height: 186,
    })

    const onResize = useDebounceCallback(setSize, 20)

    useResizeObserver({
        ref,
        onResize,
    })

    useEffect(() => {
        framer.showUI({
            title: "HubSpot",
            width,
            height,
        })
    }, [width, height])
}

export function App() {
    const ref = useRef(null)
    usePluginResizeObserver(ref)

    return (
        <main ref={ref}>
            <Router />
        </main>
    )
}
