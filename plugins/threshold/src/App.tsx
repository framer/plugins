import { PluginImage, framer } from "@framerjs/plugin-api"
import * as comlink from "comlink"
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"
import "./App.css"
import { assert, bytesFromCanvas } from "./utils"
import type { CanvasWorker } from "./worker/worker"
import Worker from "./worker/worker?worker"

const WorkerBase = comlink.wrap<typeof CanvasWorker>(new Worker())

// Remove any dangling API instances when the plugin is reloaded during development
import.meta.hot?.dispose(() => {
    framer.closePlugin()
})

setTimeout(() => {
    framer.showUI({
        width: 500,
        height: 500,
        position: "top left",
    })
}, 100)

function useSelectedImage() {
    const [image, setImage] = useState<ImageAsset | null>(null)

    useEffect(() => {
        return framer.subscribeToImage(setImage)
    }, [])

    return image
}

export function App() {
    const image = useSelectedImage()

    if (!image) {
        return <div>No image</div>
    }

    return (
        <div>
            <ThresholdImage image={image} maxWidth={400} maxHeight={400} />
        </div>
    )
}

const debounce = (fn: Function, ms = 300) => {
    let timeoutId: ReturnType<typeof setTimeout>
    return function (this: any, ...args: any[]) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => fn.apply(this, args), ms)
    }
}

function ThresholdImage({ image, maxWidth, maxHeight }: { image: PluginImage; maxWidth: number; maxHeight: number }) {
    const [threshold, setThreshold] = useState(127)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const handleSaveImage = async () => {
        const ctx = canvasRef.current?.getContext("2d")
        assert(ctx)

        const originalImage = await image.getData()

        assert(canvasRef.current)
        const nextBytes = await bytesFromCanvas(canvasRef.current)
        assert(nextBytes)

        const start = performance.now()

        framer.closeWindow()
        await framer.addImage({
            image: {
                bytes: nextBytes,
                mimeType: originalImage.mimeType,
            },
        })

        void framer.closePlugin("Image saved...")

        console.log("total duration", performance.now() - start)
    }

    const updateCanvas = useMemo(
        () =>
            debounce(async (nextThreshold: number) => {
                const worker = await new WorkerBase()

                const bitmap = await image.loadBitmap()

                const canvas = canvasRef.current
                assert(canvas)
                const ctx = canvas.getContext("2d")
                assert(ctx)

                const result = await worker.draw(bitmap, nextThreshold)

                assert(result)

                let displayWidth: number, displayHeight: number

                // Calculate the aspect ratios based on max dimensions
                const widthRatio = maxWidth / bitmap.width
                const heightRatio = maxHeight / bitmap.height

                if (widthRatio < heightRatio) {
                    // Width ratio is smaller, so we'll base dimensions on width to prevent going over maxWidth
                    displayWidth = maxWidth
                    displayHeight = bitmap.height * widthRatio
                } else {
                    // Base dimensions on height
                    displayHeight = maxHeight
                    displayWidth = bitmap.width * heightRatio
                }

                assert(ctx)

                canvas.width = displayWidth
                canvas.height = displayHeight

                ctx.drawImage(result, 0, 0, displayWidth, displayHeight)
            }, 20),
        [image]
    )

    const handleThresholdChange = useCallback(
        (nextValue: number) => {
            startTransition(() => {
                setThreshold(nextValue)
                void updateCanvas(nextValue)
            })
        },
        [updateCanvas]
    )

    useEffect(() => {
        // Start in the middle between 0-255
        void updateCanvas(127)
    }, [image])

    return (
        <div>
            <p>Thresholded Image</p>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                }}
            >
                <canvas ref={canvasRef} />

                <input
                    type="range"
                    min="0"
                    max="255"
                    value={threshold}
                    onChange={event => handleThresholdChange(Number(event.target.value))}
                />

                <button onClick={handleSaveImage}>Save Image</button>
            </div>
        </div>
    )
}
