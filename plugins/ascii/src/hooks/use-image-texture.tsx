import { useEffect, useState } from "react"
import { OGLRenderingContext, Texture } from "ogl"

export function useImageTexture(
    gl: OGLRenderingContext,
    src: string | undefined,
    onUpdate: (texture: Texture) => void
) {
    const [texture] = useState(() => new Texture(gl, { minFilter: gl.NEAREST, magFilter: gl.NEAREST }))

    useEffect(() => {
        if (!src) return

        const img = new Image()
        img.crossOrigin = "anonymous"

        img.onload = () => {
            texture.image = img
            texture.update()
            onUpdate(texture)
        }

        img.src = src
    }, [texture, src])
}
