import { useEffect, useState } from "react"
import {
    CanvasNode,
    ColorStop,
    LinearGradient,
    framer,
    withBackgroundGradient,
    withBackgroundImage,
} from "framer-plugin"
import { extractColors } from "extract-colors"
import { BrowserOptions } from "extract-colors/lib/types/Options"
import { FinalColor } from "extract-colors/lib/types/Color"
import { motion } from "framer-motion"
import "./App.css"

function useSelection() {
    const [selection, setSelection] = useState<CanvasNode[]>([])

    useEffect(() => {
        return framer.subscribeToSelection(setSelection)
    }, [])

    return selection
}

export function App() {
    const selection = useSelection()
    const [colors, setColors] = useState<FinalColor[]>([])
    const currentSelection = selection[0]

    const supportsGradient = !!currentSelection ? withBackgroundGradient(currentSelection) : false

    useEffect(() => {
        if (currentSelection) {
            if (withBackgroundImage(currentSelection)) {
                if (currentSelection.backgroundImage) {
                    const url = currentSelection.backgroundImage.url
                    const options = {
                        crossOrigin: "anonymous",
                    }
                    extractColors(url, options as BrowserOptions)
                        .then(value => {
                            setColors(value)
                        })
                        .catch(console.error)
                }
            }
        }
    }, [selection])

    const handleOnClick = async (node: CanvasNode, color: string) => {
        if (!node || !color) return
        await framer.setAttributes(node.id, {
            backgroundColor: color,
        })
    }

    const setAsGradient = async (node: CanvasNode, colors: FinalColor[]) => {
        if (!node || !colors) return
        if (!withBackgroundGradient(node)) return

        const colorStops: ColorStop[] = colors.map((color: FinalColor, index: number) => {
            return { color: color.hex, position: index / (colors.length - 1) }
        })

        const gradient = node.backgroundGradient
            ? node.backgroundGradient.cloneWithAttributes({ stops: colorStops })
            : new LinearGradient({ angle: 90, stops: colorStops })

        await framer.setAttributes(node.id, {
            backgroundGradient: gradient,
        })
    }

    const colorList = colors.map((color: FinalColor) => {
        return (
            <motion.div
                key={color.hex}
                className="color"
                whileHover={{
                    flex: 2,
                    cursor: "pointer",
                }}
                initial={{
                    flex: 1,
                }}
                transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 40,
                    restDelta: 0.0001,
                    restSpeed: 0.0001,
                }}
                onClick={() => {
                    handleOnClick(currentSelection, color.hex)
                }}
                style={{ backgroundColor: color.hex }}
            ></motion.div>
        )
    })

    return (
        <main>
            {colors.length > 0 ? (
                <>
                    <div className="interface">{colorList}</div>
                    <button
                        disabled={!supportsGradient}
                        style={{ opacity: supportsGradient ? 1 : 0.5 }}
                        onClick={() => {
                            setAsGradient(currentSelection, colors)
                        }}
                    >
                        Set Gradient
                    </button>
                </>
            ) : (
                <div className="placeholder">
                    <p>Select an Image…</p>
                </div>
            )}
        </main>
    )
}
