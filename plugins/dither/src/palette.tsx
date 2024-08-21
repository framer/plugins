import { useEffect, useState } from "react"

const DEFAULT_COLORS = ["#ffffff", "#E30613"]
// const DEFAULT_COLORS = ["#E30613", "#000000"]

export function Palette({ onChange }: { onChange?: (colors: string[]) => void }) {
    const [colors, setColors] = useState(DEFAULT_COLORS)

    useEffect(() => {
        onChange?.(colors)
    }, [colors])

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
                    />
                </div>
            ))}
        </div>
    )
}
