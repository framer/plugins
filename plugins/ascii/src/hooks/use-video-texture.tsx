import { useEffect } from "react"
import { Texture } from "ogl"
import { DroppedAsset } from "../App"

export function useVideoTexture(texture: Texture, asset: DroppedAsset, onUpdate: () => void) {
    useEffect(() => {
        if (asset.type !== "video") return

        const video = asset.asset
        video.play()

        if (!texture.image || texture.image.src !== video.src) {
            texture.image = video
            onUpdate()
        }
    }, [texture, asset])
}
