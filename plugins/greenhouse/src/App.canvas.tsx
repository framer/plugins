import { framer } from "framer-plugin"
import { useLayoutEffect } from "react"

export function AppCanvas() {
    useLayoutEffect(() => {
        framer.showUI({
            width: 360,
            height: 425,
            minWidth: 360,
            minHeight: 425,
        })
    }, [])

    return <div>canvas</div>
}
