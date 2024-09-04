import { useEffect } from "react"
import { Texture } from "ogl"
import { DroppedAsset } from "../App"

export function useImgTexture(texture: Texture, asset: DroppedAsset, onUpdate: () => void) {
    useEffect(() => {
        if (asset.type !== "image") return

        const src = asset.asset
        const img = new Image()

        img.onload = () => {
            texture.image = img
            texture.update()
            onUpdate()
        }

        img.src = src
    }, [texture, asset])
}
