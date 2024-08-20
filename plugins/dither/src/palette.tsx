import { useEffect, useState } from "react"

const DEFAULT_COLORS = ["#ccff33", "#9ef01a", "#70e000", "#38b000", "#008000", "#006400", "#004b23"]

export function Palette({ onChange }: { onChange?: (colors: string[]) => void }) {
    const [colors, setColors] = useState(DEFAULT_COLORS)
    // const [count, setCount] = useState(2)

    useEffect(() => {
        onChange?.(colors)
    }, [colors])

    // useEffect(() => {
    //     setColors(colors => {
    //         const newColors = [...colors]
    //         newColors.length = count
    //         return newColors
    //     })
    // }, [count])

    return (
        <div className="gui-palette">
            {colors.map((color, i) => (
                <div className="color">
                    <input
                        key={i}
                        type="color"
                        value={color}
                        onChange={e => {
                            const color = e.target.value
                            setColors(colors => {
                                const newColors = [...colors]
                                newColors[i] = color
                                return newColors
                            })
                        }}
                        // ref={node => {
                        //     if (!node) return

                        //     const color = node.value

                        //     if (colors[i] === color) return

                        //     setColors(colors => {
                        //         const newColors = [...colors]
                        //         newColors[i] = color
                        //         return newColors
                        //     })
                        // }}
                    />
                    {colors.length > 2 && (
                        <div className="controls">
                            <div
                                onClick={() =>
                                    setColors(() => {
                                        const newColors = [...colors]
                                        newColors.splice(i, 1)
                                        return newColors
                                    })
                                }
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">
                                    <path
                                        d="M 1.5 6.5 L 6.5 1.5"
                                        fill="transparent"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        stroke-linecap="round"
                                    ></path>
                                    <path
                                        d="M 6.5 6.5 L 1.5 1.5"
                                        fill="transparent"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        stroke-linecap="round"
                                    ></path>
                                </svg>
                            </div>
                        </div>
                    )}
                </div>
            ))}
            <div
                onClick={() =>
                    setColors(() => {
                        const newColors = [...colors]
                        newColors.push(DEFAULT_COLORS[newColors.length])
                        return newColors
                    })
                }
                className="add"
            >
                Add Color
            </div>
        </div>
    )
}
