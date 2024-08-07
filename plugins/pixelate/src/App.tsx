import { framer, CanvasNode, supportsBackgroundImage, supportsSize } from "framer-plugin"
import { useState, useEffect, useRef } from "react"
import { bytesFromCanvas } from "./utils"
import * as Slider from "@radix-ui/react-slider"
import * as Switch from "@radix-ui/react-switch"
import "./App.css"

framer.showUI({
    position: "top right",
    title: "Pixelate",
    width: 240,
    height: 315,
})

function useSelection() {
    const [selection, setSelection] = useState<CanvasNode[]>([])

    useEffect(() => {
        return framer.subscribeToSelection(setSelection)
    }, [])

    return selection
}

function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    event.target.select()
}

const PixelateWrapper = ({ src, pixelSize }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [dimensions, setDimensions] = useState({ width: 210, height: 210 })

    useEffect(() => {
        if (src && canvasRef.current) {
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.onload = () => {
                const aspectRatio = img.width / img.height
                let newWidth, newHeight
                if (aspectRatio > 1) {
                    newWidth = 210 * aspectRatio
                    newHeight = 210
                } else {
                    newWidth = 210
                    newHeight = 210 / aspectRatio
                }
                setDimensions({ width: newWidth, height: newHeight })

                const canvas = canvasRef.current
                canvas.width = newWidth
                canvas.height = newHeight
                const ctx = canvas.getContext("2d")
                if (ctx) {
                    pixelify(ctx, img, newWidth, newHeight, pixelSize)
                }
            }
            img.src = src
        }
    }, [src, pixelSize])

    const pixelify = (
        ctx: CanvasRenderingContext2D,
        img: HTMLImageElement,
        width: number,
        height: number,
        pixelSize: number
    ) => {
        ctx.drawImage(img, 0, 0, width, height)
        const isCentered = document.querySelector('.SwitchRoot[data-state="checked"]') === null
        const fillTransparencyColor = document.body.getAttribute("data-framer-theme") === "dark" ? "#252525" : "#eee"

        if (!isNaN(pixelSize) && pixelSize > 0) {
            for (let x = 0; x < width + pixelSize; x += pixelSize) {
                for (let y = 0; y < height + pixelSize; y += pixelSize) {
                    let xColorPick = x
                    let yColorPick = y
                    if (x >= width) {
                        xColorPick = x - (pixelSize - (width % pixelSize) / 2) + 1
                    }
                    if (y >= height) {
                        yColorPick = y - (pixelSize - (height % pixelSize) / 2) + 1
                    }
                    const rgba = ctx.getImageData(xColorPick, yColorPick, 1, 1).data
                    ctx.fillStyle =
                        rgba[3] === 0 ? fillTransparencyColor : `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3]})`
                    if (isCentered) {
                        ctx.fillRect(
                            Math.floor(x - (pixelSize - (width % pixelSize) / 2)),
                            Math.floor(y - (pixelSize - (height % pixelSize) / 2)),
                            pixelSize,
                            pixelSize
                        )
                    } else {
                        ctx.fillRect(x, y, pixelSize, pixelSize)
                    }
                }
            }
        }
    }

    return (
        <div
            style={{
                width: 210,
                height: 210,
                overflow: "hidden",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
        </div>
    )
}

export function App() {
    const selection = useSelection()
    const selectedLayer = selection[0]

    const imageSource =
        selectedLayer && supportsBackgroundImage(selectedLayer) ? selectedLayer.backgroundImage?.url : undefined

    const containerRef = useRef<HTMLDivElement>(null)
    const sizeInputRef = useRef<HTMLInputElement>(null)

    const [sizeValue, setSizeValue] = useState(0)
    const [sizeInputValue, setSizeInputValue] = useState("0")

    const handleSizeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value
        setSizeInputValue(newValue)
    }

    function handleSizeSliderChange(value: number[]) {
        setSizeValue(value[0])
        setSizeInputValue(`${value[0]}`)
    }

    const handleSizeInputKeydown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter") {
            const newValue = parseFloat(sizeInputValue)
            if (!isNaN(newValue) && newValue >= 0 && newValue <= 30) {
                setSizeValue(newValue)
            }
        }
    }

    const getPixelatedImageData = async () => {
        if (containerRef.current) {
            const canvas = containerRef.current.querySelector("canvas") as HTMLCanvasElement | null
            if (canvas) {
                const bytes = await bytesFromCanvas(canvas)
                return bytes ? { bytes, mimeType: "image/png" } : null
            }
        }
        return null
    }

    const handleAddImage = async () => {
        try {
            const pixelatedImageData = await getPixelatedImageData()

            if (pixelatedImageData) {
                await framer.setImage({
                    image: pixelatedImageData,
                })
            } else {
                throw new Error("Failed to get pixelated image data")
            }
        } catch (error) {
            console.error(error)
            framer.closePlugin("Failed to add image", { variant: "error" })
        }
    }

    return (
        <main>
            <div className="image-container" ref={containerRef}>
                <PixelateWrapper src={imageSource} pixelSize={sizeValue} />
            </div>
            <div className="rows-10">
                <div className={"row"}>
                    <p>Size</p>
                    <input
                        type="number"
                        placeholder="0"
                        value={sizeInputValue}
                        onChange={handleSizeInput}
                        onKeyDown={handleSizeInputKeydown}
                        onFocus={handleFocus}
                        ref={sizeInputRef}
                    />

                    <Slider.Root
                        className="SliderRoot"
                        defaultValue={[0]}
                        min={0}
                        max={50}
                        step={1}
                        onValueChange={handleSizeSliderChange}
                        value={[sizeValue]}
                    >
                        <Slider.Track className="SliderTrack sizeWidth">
                            <Slider.Range className="SliderRange" />
                        </Slider.Track>
                        <Slider.Thumb className="SliderThumb" />
                    </Slider.Root>
                </div>
                <div className={"row"}>
                    <p>Center</p>

                    <form>
                        <div style={{ display: "flex", alignItems: "center" }}>
                            <Switch.Root className="SwitchRoot">
                                <Switch.Thumb className="SwitchThumb" />
                            </Switch.Root>
                        </div>
                    </form>
                </div>
            </div>
            <button className="framer-button-secondary" onClick={handleAddImage}>
                Pixelate
            </button>
        </main>
    )
}
