import { framer, CanvasNode, supportsBackgroundImage, supportsSize } from "framer-plugin"
import { useState, useEffect, useRef } from "react"
import { Pixelify } from "react-pixelify"
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

const PixelifyWrapper = ({ src, pixelSize }) => {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const [dimensions, setDimensions] = useState({ width: 210, height: 210 })

    useEffect(() => {
        if (src) {
            const img = new Image()
            img.onload = () => {
                const aspectRatio = img.width / img.height
                if (aspectRatio > 1) {
                    setDimensions({ width: 210 * aspectRatio, height: 210 })
                } else {
                    setDimensions({ width: 210, height: 210 / aspectRatio })
                }
            }
            img.src = src
        }
    }, [src])

    const isDarkMode = document.body.getAttribute("data-framer-theme") === "dark"
    const isCentered = document.querySelector('.SwitchRoot[data-state="checked"]') === null

    return (
        <div
            ref={wrapperRef}
            style={{
                width: 210,
                height: 210,
                overflow: "hidden",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <Pixelify
                src={src}
                centered={isCentered ? true : false}
                width={dimensions.width}
                height={dimensions.height}
                pixelSize={pixelSize}
                fillTransparencyColor={isDarkMode ? "#252525" : "#eee"}
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
                // framer.closePlugin("Image added successfully")
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
                <PixelifyWrapper src={imageSource} pixelSize={sizeValue} />
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
