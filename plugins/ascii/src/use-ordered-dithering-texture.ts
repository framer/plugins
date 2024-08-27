import { useEffect, useState } from "react"
import { OGLRenderingContext, Texture } from "ogl"

export function useOrderedDitheringTexture(gl: OGLRenderingContext, orderedDithering) {
    const [texture] = useState(() => new Texture(gl, { minFilter: gl.NEAREST, magFilter: gl.NEAREST }))
    const [canvas] = useState(() => document.createElement("canvas"))

    useEffect(() => {
        const { matrix, x, y } = orderedDithering

        const pixels = new Uint8ClampedArray(x * y * 4)
        for (let i = 0; i < pixels.length; i += 4) {
            const value = matrix[i / 4]

            pixels[i] = value * 255
            pixels[i + 1] = value * 255
            pixels[i + 2] = value * 255
            pixels[i + 3] = 255
        }

        canvas.width = x
        canvas.height = y
        const ctx = canvas.getContext("2d")
        // ctx.putImageData(pixels, 0, 0)
        ctx?.putImageData(new ImageData(pixels, x, y), 0, 0)

        texture.image = pixels
        texture.width = x
        texture.height = y
        texture.update()
    }, [texture, canvas, orderedDithering])

    return { texture, canvas, width: orderedDithering.x, height: orderedDithering.y }
}
