import { useEffect, useState } from "react"
import { OGLRenderingContext, Texture } from "ogl"

export function useVideoTexture(
    gl: OGLRenderingContext,
    src: string | undefined,
    onUpdate: (texture: Texture) => void
) {
    const [texture] = useState(
        () => new Texture(gl, { minFilter: gl.NEAREST, magFilter: gl.NEAREST, generateMipmaps: false })
    )

    useEffect(() => {
        if (!src) return

        // if (src.endsWith(".mp4") || src.endsWith(".webm") || src.endsWith(".mov")) {
        const video = document.createElement("video")
        video.src = src
        video.autoplay = true
        video.loop = true
        video.muted = true
        video.playsInline = true
        video.play()

        video.addEventListener("loadeddata", () => {
            texture.image = video
            texture.width = video.videoWidth
            texture.height = video.videoHeight
            texture.update()
            onUpdate(texture)
        })

        // if (asset.type !== "video") return
        // const video = asset.asset
        // video.play()
        // if (!texture.image || texture.image.src !== video.src) {
        //     texture.image = video
        //     onUpdate()
        // }

        let raf: number

        function update() {
            texture.needsUpdate = true
            raf = requestAnimationFrame(update)
        }

        raf = requestAnimationFrame(update)

        return () => {
            cancelAnimationFrame(raf)
        }
        // }
    }, [texture, src])
}
