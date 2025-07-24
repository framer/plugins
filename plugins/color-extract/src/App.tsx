import { extractColors } from "extract-colors"
import type { FinalColor } from "extract-colors/lib/types/Color"
import type { BrowserOptions } from "extract-colors/lib/types/Options"
import {
    type CanvasNode,
    type ColorStop,
    framer,
    LinearGradient,
    supportsBackgroundGradient,
    supportsBackgroundImage,
    useIsAllowedTo,
} from "framer-plugin"
import { motion } from "motion/react"
import { useCallback, useEffect, useState } from "react"
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

    const supportsGradient = currentSelection ? supportsBackgroundGradient(currentSelection) : false

    const isAllowedToSetAttributes = useIsAllowedTo("setAttributes")

    useEffect(() => {
        if (currentSelection) {
            if (supportsBackgroundImage(currentSelection)) {
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

    const handleOnClick = useCallback(async (node: CanvasNode, color: string) => {
        if (!color) return

        await framer.setAttributes(node.id, {
            backgroundColor: color,
        })
    }, [])

    const setAsGradient = useCallback(
        async (node: CanvasNode, colors: FinalColor[]) => {
            if (!isAllowedToSetAttributes) return
            if (!supportsBackgroundGradient(node)) return

            const colorStops: ColorStop[] = colors.map((color: FinalColor, index: number) => {
                return { color: color.hex, position: index / (colors.length - 1) }
            })

            const gradient = node.backgroundGradient
                ? node.backgroundGradient.cloneWithAttributes({ stops: colorStops })
                : new LinearGradient({ angle: 90, stops: colorStops })

            await framer.setAttributes(node.id, {
                backgroundGradient: gradient,
            })
        },
        [isAllowedToSetAttributes]
    )

    const colorList = colors.map((color: FinalColor) => {
        return (
            <motion.div
                key={color.hex}
                className="color"
                whileHover={{
                    flex: 2,
                    cursor: isAllowedToSetAttributes ? "pointer" : "default",
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
                    if (!isAllowedToSetAttributes) return
                    if (!currentSelection) return
                    void handleOnClick(currentSelection, color.hex)
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
                        disabled={!supportsGradient || !isAllowedToSetAttributes}
                        style={{ opacity: supportsGradient ? 1 : 0.5 }}
                        onClick={() => {
                            if (!currentSelection) return
                            void setAsGradient(currentSelection, colors)
                        }}
                        title={isAllowedToSetAttributes ? undefined : "Insufficient permissions"}
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
