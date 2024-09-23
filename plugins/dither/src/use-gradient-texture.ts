import { useEffect, useState } from "react"
import { OGLRenderingContext, Texture } from "ogl"
import Color from "colorjs.io"

export function useGradientTexture(
    gl: OGLRenderingContext,
    { colors, quantization }: { colors: string[]; quantization: number },
    onUpdate?: (texture: Texture) => void
) {
    const [texture] = useState(() => new Texture(gl, { minFilter: gl.NEAREST, magFilter: gl.NEAREST }))

    useEffect(() => {
        if (!colors.length) return

        quantization = Math.max(2, quantization)

        const list = new Color(colors[0]).steps(colors[1], { steps: quantization, space: "hsl", outputSpace: "srgb" })

        const pixels = new Uint8ClampedArray(list.length * 4)
        for (let i = 0; i < pixels.length; i += 4) {
            const color = list[i / 4]
            pixels[i] = color.r * 255
            pixels[i + 1] = color.g * 255
            pixels[i + 2] = color.b * 255
            pixels[i + 3] = 255
        }

        texture.image = pixels
        texture.width = list.length
        texture.height = 1
        texture.update()

        onUpdate?.(texture)
    }, [texture, colors, quantization])

    return { texture }
}
