import { OGLRenderingContext, Program, Texture, Vec2 } from "ogl"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { GLSL } from "../glsl"
import { ORDERED_DITHERING_MATRICES } from "../ordered-dithering-matrices"
import { useOrderedDitheringTexture } from "../use-ordered-dithering-texture"
import { Palette } from "../palette"
import { useGradientTexture } from "../use-gradient-texture"
import * as Slider from "@radix-ui/react-slider"
import { NumberInput } from "../inputs/number-input"
import { ColorInput } from "../inputs/color-input"

export class OrderedDitherMaterial extends Program {
    constructor(gl: OGLRenderingContext, texture: Texture, ditherTexture: Texture, paletteTexture: Texture) {
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
                uniform int uMode;
                uniform vec2 uResolution;
                uniform float uPixelSize;
                uniform int uColorMode;
                uniform int uQuantization;
                uniform int uRandom;
                uniform float uBrightness;

                vec3 orderedDither(vec4 inputColor, vec2 uv) {
                    vec3 rgb = inputColor.rgb;
                    vec3 color = vec3(0.0);

                    ivec2 ditherTextureSize = textureSize(uDitherTexture, 0);

                    vec2 fragCoord = (vUv / uPixelSize) * uResolution;
                    float x = float(int(fragCoord.x) % ditherTextureSize.x) / float(ditherTextureSize.x);
                    float y = float(int(fragCoord.y) % ditherTextureSize.y) / float(ditherTextureSize.y);

                    float threshold = uRandom == 1 ? random(uv) : texture(uDitherTexture, vec2(x, y)).r;
                    threshold += uBrightness;
                    //     if (luma(rgb) >= threshold) { // Black and White
                    //         color = vec3(1.0);
                    //     }
                    
                    if (uColorMode == 0) { // Grayscale
                        color.rgb = vec3(luma(rgb));
                        threshold -= 0.45; // arbitraty threshold adjustment

                        color.r = quantize(color.r + threshold, uQuantization);
                        color.g = quantize(color.g + threshold, uQuantization);
                        color.b = quantize(color.b + threshold, uQuantization);

                    } else if (uColorMode == 1) { // RGB
                        color.rgb = rgb;
                        threshold -= 0.45; // arbitraty threshold adjustment

                        color.r = quantize(color.r + threshold, uQuantization);
                        color.g = quantize(color.g + threshold, uQuantization);
                        color.b = quantize(color.b + threshold, uQuantization);

                    } else if (uColorMode == 2) { // Custom Palette
                        color.rgb = vec3(luma(rgb));
                        threshold -= 0.45; // arbitraty threshold adjustment

                        ivec2 paletteTextureSize = textureSize(uDitherTexture, 0);

                        color.rgb = texture(uPaletteTexture, vec2(quantize(1. - (luma(rgb) + threshold), paletteTextureSize.x), 0.0)).rgb;
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
                uTexture: { value: texture },
                uResolution: { value: new Vec2(1, 1) },
                uDitherTexture: { value: ditherTexture },
                uPaletteTexture: { value: paletteTexture },
                uPixelSize: { value: 1 },
                uColorMode: { value: 0 },
                uQuantization: { value: 8 },
                uRandom: { value: 0 },
                uBrightness: { value: 0 },
            },
            transparent: true,
        })

        // this.resolution = this.uniforms.uResolution.value
    }

    setResolution(x: number, y: number) {
        this.uniforms.uResolution.value.set(Math.floor(x), Math.floor(y))
    }

    set mode(value: number) {
        this.uniforms.uMode.value = value
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
}

export const OrderedDither = forwardRef(function RandomDither(
    { gl, texture }: { gl: OGLRenderingContext; texture: Texture },
    ref
) {
    const [mode, setMode] = useState("BAYER_4x4")
    const [colorMode, setColorMode] = useState(1)
    const [quantization, setQuantization] = useState(3)
    const [isRandom, setIsRandom] = useState(false)
    const [pixelSize, setPixelSize] = useState(2)
    const [colors, setColors] = useState(["#FFFFFF", "#E30613"] as string[])

    const [brightness, setBrightness] = useState(0)

    const { texture: ditherTexture } = useOrderedDitheringTexture(gl, ORDERED_DITHERING_MATRICES[mode])
    const { texture: paletteTexture } = useGradientTexture(gl, colors, quantization)

    const [program] = useState(() => new OrderedDitherMaterial(gl, texture, ditherTexture, paletteTexture))

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
        program.brightness = brightness * 0.5
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
                    {Object.entries(ORDERED_DITHERING_MATRICES).map(([key, { title }]) => (
                        <option key={key} value={key}>
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
                            value={colors[0]}
                            onChange={(color: string) => {
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
                            value={colors[1]}
                            onChange={(color: string) => {
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
                    onValueChange={value => setPixelSize(Number(value))}
                    min={1}
                    max={100}
                    step={1}
                />
            </div>
            <div className="gui-row">
                <label className="gui-label">Brightness</label>
                <NumberInput
                    value={brightness}
                    onValueChange={value => setBrightness(Number(value))}
                    min={-1}
                    max={1}
                    step={0.01}
                />
            </div>
            <div className="gui-row">
                <label className="gui-label">Quantization</label>
                <NumberInput
                    value={quantization}
                    onValueChange={value => setQuantization(Number(value))}
                    min={2}
                    max={8}
                    step={1}
                />
            </div>
        </>
    )
})
