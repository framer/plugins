import { type OGLRenderingContext, Program, Texture, Vec2 } from "ogl"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { GLSL } from "../glsl"
import { ColorInput } from "../inputs/color-input"
import { NumberInput } from "../inputs/number-input"
import { useGradientTexture } from "../use-gradient-texture"
import { useImageTexture } from "../use-image-texture"

interface Uniforms {
    uTexture: { value: Texture }
    uResolution: { value: Vec2 }
    uDitherTexture: { value: Texture }
    uPaletteTexture: { value: Texture }
    uPixelSize: { value: number }
    uColorMode: { value: number }
    uQuantization: { value: number }
    uRandom: { value: number }
    uBrightness: { value: number }
    uRed: { value: number }
    uGreen: { value: number }
    uBlue: { value: number }
}

export class OrderedDitherMaterial extends Program {
    declare uniforms: Uniforms

    constructor(gl: OGLRenderingContext) {
        super(gl, {
            vertex: /*glsl*/ `#version 300 es
                precision lowp float;
                
                in vec3 position;
                in vec2 uv;

                out vec2 vUv;

                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;

                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
                `,
            fragment: /*glsl*/ `#version 300 es
                precision lowp float;

                ${GLSL.RANDOM}
                ${GLSL.LUMA}
                ${GLSL.QUANTIZE}

                in vec2 vUv;
                out vec4 fragColor;

                uniform sampler2D uTexture;
                uniform sampler2D uDitherTexture;
                uniform sampler2D uPaletteTexture;
                uniform vec2 uResolution;
                uniform float uPixelSize;
                uniform int uColorMode;
                uniform int uQuantization;
                uniform int uRandom;
                uniform float uBrightness;
                uniform float uRed;
                uniform float uGreen;
                uniform float uBlue;

                float grayscale(vec3 color) {
                    return dot(color, vec3(uRed, uGreen, uBlue));
                    // return dot(color, vec3(0.299, 0.587, 0.114));
                }

                vec3 orderedDither(vec4 inputColor, vec2 uv) {
                    vec3 rgb = inputColor.rgb;
                    vec3 color = vec3(0.0);

                    ivec2 ditherTextureSize = textureSize(uDitherTexture, 0);

                    vec2 fragCoord = (vUv / uPixelSize) * uResolution;
                    float x = float(int(fragCoord.x) % ditherTextureSize.x) / float(ditherTextureSize.x);
                    float y = float(int(fragCoord.y) % ditherTextureSize.y) / float(ditherTextureSize.y);

                    // vec3 threshold = uRandom == 1 ? vec3(random(uv)) : texture(uDitherTexture, vec2(x, y)).rgb;
                    float threshold = uRandom == 1 ? random(uv) : grayscale(texture(uDitherTexture, vec2(x, y)).rgb);
                    threshold += uBrightness;
                    threshold -= 0.33; // arbitraty threshold adjustment
                    //     if (luma(rgb) >= threshold) { // Black and White
                    //         color = vec3(1.0);
                    //     }
                    
                    if (uColorMode == 0) { // Grayscale
                        color.rgb = vec3(luma(rgb));

                        color.r = quantize(color.r + threshold, uQuantization);
                        color.g = quantize(color.g + threshold, uQuantization);
                        color.b = quantize(color.b + threshold, uQuantization);

                    } else if (uColorMode == 1) { // RGB
                        color.rgb = rgb;

                        color.r = quantize(color.r + threshold, uQuantization);
                        color.g = quantize(color.g + threshold, uQuantization);
                        color.b = quantize(color.b + threshold, uQuantization);

                    } else if (uColorMode == 2) { // Custom Palette
                        color.rgb = vec3(luma(rgb));

                        ivec2 paletteTextureSize = textureSize(uPaletteTexture, 0);
                        color = texture(uPaletteTexture, vec2(quantize(1. - (luma(rgb) + threshold), paletteTextureSize.x), 0.0)).rgb;
                    }

                    return color;
                }



                void main() {
                    vec2 pixelSize = uPixelSize / uResolution;
                    vec2 pixelizedUv = floor(vUv / pixelSize) * pixelSize;
                    vec4 color = texture(uTexture, pixelizedUv);

                    fragColor = vec4(orderedDither(color, pixelizedUv), color.a);

                    
                }
                `,
            uniforms: {
                uTexture: { value: new Texture(gl) },
                uResolution: { value: new Vec2(1, 1) },
                uDitherTexture: { value: new Texture(gl) },
                uPaletteTexture: { value: new Texture(gl) },
                uPixelSize: { value: 1 },
                uColorMode: { value: 0 },
                uQuantization: { value: 8 },
                uRandom: { value: 0 },
                uBrightness: { value: 0 },
                uRed: { value: 0.299 },
                uGreen: { value: 0.587 },
                uBlue: { value: 0.114 },
            } satisfies Uniforms,
            transparent: true,
        })
    }

    setResolution(x: number, y: number) {
        this.uniforms.uResolution.value.set(Math.floor(x), Math.floor(y))
    }

    set pixelSize(value: number) {
        this.uniforms.uPixelSize.value = value
    }

    set colorMode(value: number) {
        this.uniforms.uColorMode.value = value
    }

    set quantization(value: number) {
        this.uniforms.uQuantization.value = Math.floor(value)
    }

    set isRandom(value: boolean) {
        this.uniforms.uRandom.value = value ? 1 : 0
    }

    set brightness(value: number) {
        this.uniforms.uBrightness.value = value
    }

    set ditheredTexture(value: Texture) {
        this.uniforms.uDitherTexture.value = value
    }

    set texture(value: Texture) {
        this.uniforms.uTexture.value = value
    }

    set paletteTexture(value: Texture) {
        this.uniforms.uPaletteTexture.value = value
    }

    set red(value: number) {
        this.uniforms.uRed.value = value
    }

    get red() {
        return this.uniforms.uRed.value
    }

    set green(value: number) {
        this.uniforms.uGreen.value = value
    }

    get green() {
        return this.uniforms.uGreen.value
    }

    set blue(value: number) {
        this.uniforms.uBlue.value = value
    }

    get blue() {
        return this.uniforms.uBlue.value
    }
}

const MATRICES = [
    {
        title: "Bayer 4x4",
        id: "BAYER_4x4",
        src: "/bayer4x4.bmp",
    },
    {
        title: "Line Horizontal 1x4",
        id: "LINE_HORIZ_1x4",
        src: "/line-horiz-1x4.bmp",
    },
    {
        title: "Line Vertical 4x1",
        id: "LINE_VERT_4x1",
        src: "/line-vert-4x1.bmp",
    },
    {
        title: "Line Diagonal 4x4",
        id: "LINE_DIAG_4x4",
        src: "/line-diag-4x4.bmp",
    },
    {
        title: "Dot Matrix 5x5",
        id: "DOT_MATRIX_5x5",
        src: "/dot-matrix-5x5.bmp",
    },
    {
        title: "Waves 4x16",
        id: "WAVES_4x16",
        src: "/waves-4x16.bmp",
    },
]

const SHOW_DEV_TOOLS = false as boolean

export interface OrderedDitherRef {
    program: OrderedDitherMaterial
    setPixelSize: (value: number) => void
}

export const OrderedDither = forwardRef<OrderedDitherRef, { gl: OGLRenderingContext }>(function RandomDither(
    { gl },
    ref
) {
    const [mode, setMode] = useState<string>("BAYER_4x4")
    const [colorMode, setColorMode] = useState(1)
    const [quantization, setQuantization] = useState(3)
    const [isRandom, setIsRandom] = useState(false)
    const [pixelSize, setPixelSize] = useState(2)
    const [colors, setColors] = useState(["#FFFFFF", "#E30613"] as string[])

    const [brightness, setBrightness] = useState(0)

    useGradientTexture(gl, { colors, quantization }, (texture: Texture) => {
        program.paletteTexture = texture
    })

    const [program] = useState(() => new OrderedDitherMaterial(gl))

    useImageTexture(
        gl,
        MATRICES.find(matrix => matrix.id === mode)?.src,
        texture => {
            program.ditheredTexture = texture
        },
        [program]
    )

    useEffect(() => {
        program.colorMode = colorMode
    }, [program, colorMode])

    useEffect(() => {
        program.quantization = quantization
    }, [program, quantization])

    useEffect(() => {
        program.isRandom = isRandom
    }, [program, isRandom])

    useEffect(() => {
        program.pixelSize = pixelSize
    }, [program, pixelSize])

    useEffect(() => {
        program.brightness = brightness / 200
    }, [program, brightness])

    useImperativeHandle(
        ref,
        () => ({
            program,
            setPixelSize: (value: number) => {
                setPixelSize(Math.max(1, Math.min(Math.round(value), 100)))
            },
        }),
        [program, setPixelSize]
    )

    return (
        <>
            {process.env.NODE_ENV === "development" && SHOW_DEV_TOOLS && (
                <>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.001"
                        defaultValue={program.red}
                        onChange={e => (program.red = Number(e.target.value))}
                    />
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.001"
                        defaultValue={program.green}
                        onChange={e => (program.green = Number(e.target.value))}
                    />
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.001"
                        defaultValue={program.blue}
                        onChange={e => (program.blue = Number(e.target.value))}
                    />
                </>
            )}
            <div className="gui-row">
                <label className="gui-label">Mode</label>
                <select
                    onChange={e => {
                        const value = e.target.value

                        if (value === "RANDOM") {
                            setIsRandom(true)
                        } else {
                            setMode(value)
                            setIsRandom(false)
                        }
                    }}
                    className="gui-select"
                    defaultValue={mode}
                >
                    <option value="RANDOM">Random</option>
                    {MATRICES.map(({ title, id }) => (
                        <option key={id} value={id}>
                            {title}
                        </option>
                    ))}
                </select>
            </div>

            <div className="gui-row">
                <label className="gui-label">Color Mode</label>
                <select
                    onChange={e => {
                        setColorMode(Number(e.target.value))
                    }}
                    className="gui-select"
                    value={colorMode}
                >
                    <option value="1">RGB</option>
                    <option value="0">Grayscale</option>
                    <option value="2">Palette</option>
                </select>
            </div>

            {[2].includes(colorMode) && (
                <>
                    <div className="gui-row">
                        <label className="gui-label">Color A</label>
                        <ColorInput
                            value={colors[0] ?? ""}
                            onChange={color => {
                                if (typeof color !== "string") return
                                setColors(v => {
                                    const newColors = [...v]
                                    newColors[0] = color
                                    return newColors
                                })
                            }}
                        />
                    </div>
                    <div className="gui-row">
                        <label className="gui-label">Color B</label>
                        <ColorInput
                            value={colors[1] ?? ""}
                            onChange={color => {
                                if (typeof color !== "string") return
                                setColors(v => {
                                    const newColors = [...v]
                                    newColors[1] = color
                                    return newColors
                                })
                            }}
                        />
                    </div>
                </>
            )}

            <div className="gui-row">
                <label className="gui-label">Pixelation</label>
                <NumberInput
                    value={pixelSize}
                    onValueChange={value => {
                        setPixelSize(Number(value))
                    }}
                    min={1}
                    max={50}
                    step={1}
                />
            </div>
            <div className="gui-row">
                <label className="gui-label">Brightness</label>
                <NumberInput
                    value={brightness}
                    onValueChange={value => {
                        setBrightness(Number(value))
                    }}
                    min={-100}
                    max={100}
                    step={1}
                />
            </div>
            <div className="gui-row">
                <label className="gui-label">Quantization</label>
                <NumberInput
                    value={quantization}
                    onValueChange={value => {
                        setQuantization(Number(value))
                    }}
                    min={2}
                    max={8}
                    step={1}
                />
            </div>
        </>
    )
})
