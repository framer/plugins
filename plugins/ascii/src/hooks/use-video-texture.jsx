import { useState } from "react"
import { Texture } from "ogl"

export function useVideoTexture(gl, src) {
    const [texture] = useState(() => new Texture(gl, { minFilter: gl.LINEAR, magFilter: gl.LINEAR }))

    return texture
}
