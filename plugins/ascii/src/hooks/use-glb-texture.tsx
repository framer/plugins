import { useEffect } from "react"
import { DroppedAsset } from "../App"

export function useGLBTexture(asset: DroppedAsset, onUpdate: () => void) {
    useEffect(() => {
        if (asset.type !== "model") return

        onUpdate()
    }, [asset])
}
