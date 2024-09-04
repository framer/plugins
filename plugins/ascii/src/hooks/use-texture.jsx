import { useEffect, useState } from "react"
import { Texture } from "ogl"

export function useTexture(gl, src) {
    const [texture] = useState(() => new Texture(gl, { minFilter: gl.LINEAR, magFilter: gl.LINEAR }))

    useEffect(() => {
        const img = new Image()
        img.onload = () => {
            texture.image = img
            texture.update()
        }
        img.src = src
    }, [texture, src])

    return texture
}
