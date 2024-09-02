import { useEffect, useState } from "react"
import { OGLRenderingContext, Texture } from "ogl"

export function useCharactersAtlasTexture(
    gl: OGLRenderingContext,
    {
        characters,
        size = 64,
        debug = import.meta.env.DEV,
        font,
    }: {
        characters: string
        size?: number
        debug?: boolean
        font?: string
    }
) {
    const [texture] = useState(() => new Texture(gl, { minFilter: gl.LINEAR, magFilter: gl.LINEAR }))
    const [canvas] = useState(() => document.createElement("canvas"))

    useEffect(() => {
        if (characters.length === 0) return

        const context = canvas.getContext("2d")
        if (!context) return

        context?.clearRect(0, 0, canvas.width, canvas.height)

        canvas.width = size * characters.length
        canvas.height = size

        // context.beginPath() // Start a new path
        // context.rect(10, 20, 150, 100) // Add a rectangle to the current path
        // context.fill() // Render the path

        context.font = `${size}px ${font}, monospace`
        context.textBaseline = "middle"
        context.textAlign = "center"

        characters.split("").forEach((character, index) => {
            if (debug) {
                // context.strokeStyle = "#f00"
                // context.strokeRect(index * size, 0, size, size)
            }

            context.fillStyle = "#fff"
            context.fillText(character, index * size + size / 2, size / 1.65)
        })

        const pixels = context.getImageData(0, 0, canvas.width, canvas.height)

        texture.image = pixels.data
        texture.width = canvas.width
        texture.height = canvas.height
        texture.update()
    }, [texture, canvas, characters, font])

    useEffect(() => {
        if (!debug) return

        document.body.appendChild(canvas)
        canvas.style.position = "absolute"
        canvas.style.top = "0"
        canvas.style.left = "0"
        const aspect = canvas.width / canvas.height

        canvas.style.width = `128px`
        canvas.style.height = `${128 / aspect}px`

        return () => {
            document.body.removeChild(canvas)
        }
    }, [texture, canvas, characters])

    return { texture, canvas, width: characters.length, height: 1 }
}
