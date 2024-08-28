import { useEffect, useState } from "react"
import { OGLRenderingContext, Texture } from "ogl"

const CELL_SIZE = 64

export function useCharactersAtlasTexture(
    gl: OGLRenderingContext,
    {
        characters,
        fontSize = 24,
    }: {
        characters: string
        fontSize: number
    }
) {
    const [texture] = useState(() => new Texture(gl, { minFilter: gl.NEAREST, magFilter: gl.NEAREST }))
    const [canvas] = useState(() => document.createElement("canvas"))

    useEffect(() => {
        console.log(characters)

        const context = canvas.getContext("2d")
        context?.clearRect(0, 0, canvas.width, canvas.height)

        canvas.width = CELL_SIZE * characters.length
        canvas.height = CELL_SIZE

        // context.beginPath() // Start a new path
        // context.rect(10, 20, 150, 100) // Add a rectangle to the current path
        // context.fill() // Render the path

        context.font = `${CELL_SIZE}px monospace`
        context.textBaseline = "middle"
        context.textAlign = "center"

        characters.split("").forEach((character, index) => {
            context.strokeStyle = "#f00"
            context.strokeRect(index * CELL_SIZE, 0, CELL_SIZE, CELL_SIZE)

            context.fillStyle = "#fff"
            context.fillText(character, index * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 1.65)
        })

        // context.font = "48px serif"
        // context.fillText("Hello world", 10, 50)

        // const pixels = new Uint8ClampedArray(x * y * 4)
        // for (let i = 0; i < pixels.length; i += 4) {
        //     const value = matrix[i / 4]
        //     pixels[i] = value * 255
        //     pixels[i + 1] = value * 255
        //     pixels[i + 2] = value * 255
        //     pixels[i + 3] = 255
        // }
        // canvas.width = x
        // canvas.height = y
        // const ctx = canvas.getContext("2d")
        // // ctx.putImageData(pixels, 0, 0)
        // ctx?.putImageData(new ImageData(pixels, x, y), 0, 0)
        // texture.image = pixels
        // texture.width = x
        // texture.height = y
        // texture.update()
    }, [texture, canvas, characters])

    useEffect(() => {
        document.body.appendChild(canvas)
        canvas.style.position = "absolute"
        canvas.style.top = "0"
        canvas.style.left = "0"
        const aspect = canvas.width / canvas.height

        console.log(canvas.width, canvas.height, aspect)

        canvas.style.width = `128px`
        canvas.style.height = `${128 / aspect}px`

        return () => {
            document.body.removeChild(canvas)
        }
    }, [texture, canvas, characters])

    return { texture, canvas }
}
