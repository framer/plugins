import * as comlink from "comlink"
import { ImageAsset, framer } from "framer-plugin"
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"
import "./App.css"
import { Spinner } from "./Spinner"
import { assert, bytesFromCanvas } from "./utils"
import type { CanvasWorker } from "./worker/worker"
import Worker from "./worker/worker?worker"

const WorkerBase = comlink.wrap<typeof CanvasWorker>(new Worker())

void framer.showUI({ position: "top left", width: 280, height: 260 })

function useSelectedImage() {
    const [image, setImage] = useState<ImageAsset | null>(null)

    console.log("image", image)

    useEffect(() => {
        return framer.subscribeToImage(setImage)
    }, [])

    return image
}

export function App() {
    const image = useSelectedImage()

    if (!image) {
        return (
            <div className="error-container">
                <p>Select an Image</p>
            </div>
        )
    }

    return <ThresholdImage image={image} maxWidth={248} maxHeight={400} />
}

const debounce = (fn: Function, ms = 300) => {
    let timeoutId: ReturnType<typeof setTimeout>
    return function (this: any, ...args: any[]) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => fn.apply(this, args), ms)
    }
}

function ThresholdImage({ image, maxWidth, maxHeight }: { image: ImageAsset; maxWidth: number; maxHeight: number }) {
    const [threshold, setThreshold] = useState(127)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hasPainted, setHasPainted] = useState(false)

    const handleSaveImage = async () => {
        const ctx = canvasRef.current?.getContext("2d")
        assert(ctx)

        const originalImage = await image.getData()

        assert(canvasRef.current)
        const nextBytes = await bytesFromCanvas(canvasRef.current)
        assert(nextBytes)

        const start = performance.now()

        framer.hideUI()
        await framer.setImage({
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

                framer.showUI({
                    position: "top left",
                    width: 280,
                    height: displayHeight + 95,
                })

                ctx.drawImage(result, 0, 0, displayWidth, displayHeight)

                setHasPainted(true)
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
        <div className="container">
            <div className="canvas-container">
                <canvas ref={canvasRef} />
                {!hasPainted && <Spinner size="medium" />}
            </div>

            <input
                type="range"
                min="0"
                max="255"
                value={threshold}
                onChange={event => handleThresholdChange(Number(event.target.value))}
            />

            <button onClick={handleSaveImage}>Save Image</button>
        </div>
    )
}
