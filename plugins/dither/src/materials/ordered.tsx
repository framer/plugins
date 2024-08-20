import { OGLRenderingContext, Program, Texture, Vec2 } from "ogl"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { GLSL } from "../glsl"
import { ORDERED_DITHERING_MATRICES } from "../ordered-dithering-matrices"
import { useOrderedDitheringTexture } from "../use-ordered-dithering-texture"
import { Palette } from "../palette"
import { useGradientTexture } from "../use-gradient-texture"

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


                float quantize (float value, int quant) {
                    return floor(value * (float(quant) - 1.0) + 0.5) / (float(quant) - 1.0);
                }


                vec3 orderedDither(vec3 rgb, vec2 uv) {
                    vec3 color = vec3(0.0);

                    ivec2 ditherTextureSize = textureSize(uDitherTexture, 0);

                    vec2 fragCoord = (vUv / uPixelSize) * uResolution;
                    float x = float(int(fragCoord.x) % ditherTextureSize.x) / float(ditherTextureSize.x);
                    float y = float(int(fragCoord.y) % ditherTextureSize.y) / float(ditherTextureSize.y);

                    float threshold = uRandom == 1 ? random(uv) : texture(uDitherTexture, vec2(x, y)).r;

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

                    
                    // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);

                    // gl_FragColor = texture2D(uDitherTexture, vUv);

                    fragColor = vec4(orderedDither(color.rgb, pixelizedUv), color.a);

                    if(vUv.y >= 0.9) {
                        fragColor = texture(uPaletteTexture, vUv);
                    }

                    

                    // fragColor = color;
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
            },
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

    // set ditherPixelSize(value: number) {
    //     this.uniforms.uDitherPixelSize.value = value
    // }
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
    const [colors, setColors] = useState([] as string[])

    const { texture: ditherTexture } = useOrderedDitheringTexture(gl, ORDERED_DITHERING_MATRICES[mode])
    const { texture: paletteTexture } = useGradientTexture(gl, colors, quantization)

    // useEffect(() => {
    //     // document.body.appendChild(canvas)

    //     canvas.style.cssText = `
    //         position: absolute;
    //         top: 0;
    //         left: 0;
    //         width: 128px;
    //         height: 128px;
    //         pointer-events: none;

    //     `
    // }, [ditherTexture, canvas])

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

    // useEffect(() => {
    //     program.ditherPixelSize = ditherPixelSize
    // }, [program, ditherPixelSize])

    useImperativeHandle(ref, () => ({ program }), [program])

    return (
        <div className="gui">
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
                <label className="gui-label">Pixelation</label>
                <input
                    type="range"
                    min="1"
                    max="6"
                    defaultValue={pixelSize}
                    value={pixelSize}
                    onChange={e => setPixelSize(Number(e.target.value))}
                    className="gui-select"
                />
            </div>
            <div className="gui-row">
                <label className="gui-label">Color Mode</label>
                <select
                    onChange={e => {
                        setColorMode(Number(e.target.value))
                    }}
                    className="gui-select"
                    value={colorMode}
                    defaultValue={colorMode}
                >
                    <option value="0">Grayscale</option>
                    <option value="1">RGB</option>
                    {/* <option value="2">Grayscale</option>
                    <option value="3">True Colors</option> */}
                    <option value="2">Custom Palette</option>
                </select>
            </div>
            {[0, 1, 2].includes(colorMode) && (
                <div className="gui-row">
                    <label className="gui-label">Quantization</label>
                    <input
                        type="range"
                        min="2"
                        max="8"
                        value={quantization}
                        defaultValue={quantization}
                        onChange={e => setQuantization(parseInt(e.target.value))}
                        className="gui-select"
                    />
                </div>
            )}
            {[2].includes(colorMode) && (
                <div className="gui-row">
                    <label className="gui-label">Palette</label>
                    <Palette
                        onChange={colors => {
                            setColors(colors)
                        }}
                    />
                </div>
            )}
        </div>
    )
})
