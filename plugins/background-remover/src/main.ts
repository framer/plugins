import { framer, supportsBackgroundImage } from "framer-plugin"
import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal"

const isLocal = () => window.location.hostname.includes("localhost")

const determineDevice = () => {
    if ("gpu" in navigator) return "gpu"
    const canvas = document.createElement("canvas")
    const hasWebGL = !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))

    return hasWebGL ? "gpu" : "cpu"
}

async function processImage(imageUrl: string): Promise<File | null> {
    const startTime = performance.now()

    try {
        const blob = await imglyRemoveBackground(imageUrl, {
            output: { quality: 1, format: "image/png" },
            model: "isnet_fp16",
            device: determineDevice(),
        })

        if (isLocal()) {
            const duration = (performance.now() - startTime).toFixed(2)
            console.log(`Background removal duration: ${duration} ms`)
        }

        return new File([blob], "image", { type: "image/png" })
    } catch (e) {
        return null
    }
}

async function handleEditImageMode() {
    const image = await framer.getImage()

    if (!image) {
        await framer.closePlugin("No image selected")
        return
    }

    const result = await processImage(image.url)

    if (result) {
        await framer.setImage({ image: result })
        await framer.closePlugin("Background removed", { variant: "success" })
    } else {
        await framer.closePlugin("Failed to remove background", { variant: "error" })
    }
}

async function handleCanvasMode() {
    const selection = await framer.getSelection()

    if (selection.length === 0) {
        await framer.closePlugin("Please select a node", { variant: "error" })
        return
    }

    let processedCount = 0
    let failedCount = 0

    for (const node of selection) {
        if (supportsBackgroundImage(node) && node.backgroundImage?.url) {
            try {
                const processedImage = await processImage(node.backgroundImage.url)
                if (processedImage) {
                    await framer.setSelection([node.id])
                    await framer.setImage({ image: processedImage })
                    processedCount++
                } else {
                    failedCount++
                }
            } catch (e) {
                failedCount++
            }
        }
    }

    await framer.setSelection([])

    let message: string
    let variant: "success" | "error"

    if (processedCount > 0 && failedCount === 0) {
        message = "Background removed"
        variant = "success"
    } else if (failedCount > 0) {
        message = `Failed to remove backgrounds for ${failedCount} image(s)`
        variant = "error"
    } else {
        // Nothing was processed
        message = "Please select a node with a background image"
        variant = "error"
    }

    await framer.closePlugin(message, { variant })
}

async function runPlugin() {
    if (framer.mode === "editImage") {
        await handleEditImageMode()
    } else {
        await handleCanvasMode()
    }
}

runPlugin()
