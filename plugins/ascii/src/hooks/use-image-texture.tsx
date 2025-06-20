import { type OGLRenderingContext, Texture } from "ogl"
import { type DependencyList, useEffect, useState } from "react"

export function useImageTexture(
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

        const img = new Image()
        img.crossOrigin = "anonymous"

        img.onload = () => {
            texture.image = img
            texture.update()
            onUpdate(texture)
        }

        img.src = src
    }, [texture, src, ...deps])
}
