import { type OGLRenderingContext, Texture } from "ogl"
import { type DependencyList, useEffect, useState } from "react"

export function useVideoTexture(
    gl: OGLRenderingContext,
    src: string | undefined,
    onUpdate: (texture: Texture) => void,
    deps: DependencyList = []
) {
    const [texture] = useState(
        () => new Texture(gl, { minFilter: gl.NEAREST, magFilter: gl.NEAREST, generateMipmaps: false })
    )

    useEffect(() => {
        if (!src) return

        const video = document.createElement("video")
        video.src = src
        video.autoplay = true
        video.loop = true
        video.muted = true
        video.playsInline = true
        void video.play()

        video.addEventListener("loadeddata", () => {
            texture.image = video
            texture.width = video.videoWidth
            texture.height = video.videoHeight
            texture.update()
            onUpdate(texture)
        })

        let raf: number

        function update() {
            if (video.readyState >= video.HAVE_ENOUGH_DATA) {
                texture.image ??= video
                texture.needsUpdate = true
            }
            raf = requestAnimationFrame(update)
        }

        raf = requestAnimationFrame(update)

        return () => {
            cancelAnimationFrame(raf)
        }
    }, [texture, src, ...deps])
}
