import { framer } from "framer-plugin"
import { bytesFromCanvas } from "./utils"

const isAllowedToUpsertImage = framer.isAllowedTo("setImage")
if (!isAllowedToUpsertImage) {
    await framer.closePlugin("You don't have permission to edit images.", { variant: "error" })
}

const image = await framer.getImage()
if (!image) {
    await framer.closePlugin("No Image was selected.", { variant: "error" })
    throw new Error("Unreachable")
}

try {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) {
        throw new Error("ctx is null")
    }

    const { mimeType } = await image.getData()
    const img = await image.loadBitmap()

    ctx.canvas.width = img.width
    ctx.canvas.height = img.height

    // Flip the context horizontally
    ctx.scale(-1, 1)
    ctx.drawImage(img, -img.width, 0)

    const result = await bytesFromCanvas(canvas)
    if (!result) {
        throw new Error("Result is not defined")
    }

    await framer.setImage({
        image: { bytes: result, mimeType },
    })

    await framer.closePlugin("Image flipped successfully")
} catch (err) {
    await framer.closePlugin("Unexpected error", { variant: "error" })
}
