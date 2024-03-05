import { useEffect, useLayoutEffect, useRef, useState } from "react"
import rough from "roughjs"
import "./App.css"
import { api } from "./api"

export function App() {
    useEffect(() => {
        api.showWindow()
    }, [])

    const ref = useRef<SVGSVGElement>(null)

    const [shape, setShape] = useState<"rectangle" | "line" | "ellipse">("rectangle")
    const [aspectRatio, setAspectRatio] = useState(1)
    const [strokeColor, setStrokeColor] = useState("#09f")
    const [strokeWidth, setStrokeWidth] = useState(1)
    const [roughness, setRoughness] = useState(1)
    const [fillWeight, setFillWeight] = useState(0.5)
    const [fillColor, setFillColor] = useState("#333")
    const [fillStyle, setFillStyle] = useState<
        "solid" | "zigzag" | "cross-hatch" | "dots" | "sunburst" | "dashed" | "zigzag-line"
    >("zigzag")
    const [angle, setAngle] = useState(-41)
    const [gap, setGap] = useState(4)

    useLayoutEffect(() => {
        if (!ref.current) return

        const svgElement = ref.current

        // Clear SVG
        while (svgElement.firstChild) {
            svgElement.removeChild(svgElement.firstChild)
        }

        let width = 80
        let height = 80

        if (aspectRatio > 1) {
            height = height / aspectRatio
        }

        const rc = rough.svg(svgElement)

        const options = {
            fill: fillColor,
            fillStyle,
            stroke: strokeColor,
            roughness,
            strokeWidth,
            hachureAngle: angle,
            hachureGap: gap,
            fillWeight,
        }

        switch (shape) {
            case "rectangle": {
                const node = rc.rectangle(10, (100 - height) / 2, width, height, { ...options })
                svgElement.appendChild(node)
                break
            }
            case "line": {
                const node = rc.line(10, 50, 90, 50, { ...options })
                svgElement.appendChild(node)
                break
            }
            case "ellipse": {
                const node = rc.ellipse(50, 50, width, height, { ...options })
                svgElement.appendChild(node)
                break
            }
        }
    }, [fillStyle, fillColor, strokeColor, shape, aspectRatio, roughness, strokeWidth, angle, gap, fillWeight])

    const handleAddSvg = async () => {
        if (!ref.current) return

        const svgElement = ref.current
        const svg = new XMLSerializer().serializeToString(svgElement)

        await api.addSVG({
            svg: svg,
            name: "framer.svg",
        })
    }

    return (
        <main>
            <div className="controls-wrapper">
                <div className="controls">
                    <div className="controls-title">Shape</div>
                    <Control label="Type">
                        <select value={shape} onChange={e => setShape(e.target.value as any)}>
                            <option value="rectangle">Rectangle</option>
                            <option value="line">Line</option>
                            <option value="ellipse">Ellipse</option>
                        </select>
                    </Control>
                    {shape !== "line" && (
                        <Control label="Ratio">
                            <input
                                type="range"
                                min="1"
                                max="5"
                                step="0.1"
                                value={aspectRatio}
                                onChange={e => setAspectRatio(Number(e.target.value))}
                            />
                        </Control>
                    )}
                    <Control label="Color">
                        <input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} />
                    </Control>
                    <Control label="Stroke">
                        <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.1"
                            value={strokeWidth}
                            onChange={e => setStrokeWidth(Number(e.target.value))}
                        />
                    </Control>
                </div>
                {shape !== "line" && (
                    <div className="controls">
                        <div className="controls-title">Fill</div>
                        <Control label="Color">
                            <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} />
                        </Control>
                        <Control label="Style">
                            <select value={fillStyle} onChange={e => setFillStyle(e.target.value as any)}>
                                <option value="solid">Solid</option>
                                <option value="zigzag">Zigzag</option>
                                <option value="cross-hatch">Cross-hatch</option>
                                <option value="dots">Dots</option>
                                <option value="sunburst">Sunburst</option>
                                <option value="dashed">Dashed</option>
                                <option value="zigzag-line">Zigzag-line</option>
                            </select>
                        </Control>
                        {fillStyle !== "solid" && (
                            <Control label="Weight">
                                <input
                                    type="range"
                                    min="0"
                                    max="3"
                                    step="0.1"
                                    value={fillWeight}
                                    onChange={e => setFillWeight(Number(e.target.value))}
                                />
                            </Control>
                        )}
                        {!["solid", "dots"].includes(fillStyle) && (
                            <Control label="Angle">
                                <input
                                    type="range"
                                    min="-180"
                                    max="180"
                                    step="1"
                                    value={angle}
                                    onChange={e => setAngle(Number(e.target.value))}
                                />
                            </Control>
                        )}
                        {fillStyle !== "solid" && (
                            <Control label="Gap">
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="0.5"
                                    value={gap}
                                    onChange={e => setGap(Number(e.target.value))}
                                />
                            </Control>
                        )}
                    </div>
                )}
                <div className="controls">
                    <div className="controls-title">Drawing Style</div>
                    <Control label="Roughness">
                        <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.1"
                            value={roughness}
                            onChange={e => setRoughness(Number(e.target.value))}
                        />
                    </Control>
                </div>
            </div>
            <div className="image-wrapper">
                <svg ref={ref} viewBox="0 0 100 100" />
            </div>
            <div className="footer">
                <button onClick={handleAddSvg}>Add Shape</button>
            </div>
        </main>
    )
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="control">
            <div className="control-label">{label}</div>
            {children}
        </div>
    )
}
