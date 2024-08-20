import { useEffect, useState } from "react"
import { OGLRenderingContext, Texture, Color } from "ogl"

export function useGradientTexture(gl: OGLRenderingContext, colors: string[]) {
    const [texture] = useState(() => new Texture(gl, { minFilter: gl.NEAREST, magFilter: gl.NEAREST }))
    const [canvas] = useState(() => document.createElement("canvas"))

    useEffect(() => {
        if (!colors.length) return

        const pixels = new Uint8ClampedArray(colors.length * 4)
        for (let i = 0; i < pixels.length; i += 4) {
            const color = new Color(colors[i / 4])
            pixels[i] = color.r * 255
            pixels[i + 1] = color.g * 255
            pixels[i + 2] = color.b * 255
            pixels[i + 3] = 255
        }

        canvas.width = colors.length
        canvas.height = 1
        const ctx = canvas.getContext("2d")
        // ctx.putImageData(pixels, 0, 0)
        ctx?.putImageData(new ImageData(pixels, colors.length, 1), 0, 0)

        texture.image = pixels
        texture.width = colors.length
        texture.height = 1
        texture.update()
    }, [texture, canvas, colors])

    return { texture }
}
