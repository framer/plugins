import { OGLRenderingContext, Program, Texture, Vec2 } from "ogl"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { GLSL } from "../glsl"
// import { ORDERED_DITHERING_MATRICES } from "../ordered-dithering-matrices"
// import { useOrderedDitheringTexture } from "../use-ordered-dithering-texture"
import { useGradientTexture } from "../use-gradient-texture"
import { NumberInput } from "../inputs/number-input"
import { ColorInput } from "../inputs/color-input"
import { useImageTexture } from "../use-image-texture"

export class OrderedDitherMaterial extends Program {
    constructor(gl: OGLRenderingContext, texture: Texture, paletteTexture: Texture) {
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

                    // vec3 threshold = uRandom == 1 ? vec3(random(uv)) : texture(uDitherTexture, vec2(x, y)).rgb;
                    float threshold = uRandom == 1 ? random(uv) : luma(texture(uDitherTexture, vec2(x, y)).rgb);
                    threshold += uBrightness;
                    threshold -= 0.35; // arbitraty threshold adjustment
                    //     if (luma(rgb) >= threshold) { // Black and White
                    //         color = vec3(1.0);
                    //     }
                    
                    if (uColorMode == 0) { // Grayscale
                        color.rgb = vec3(luma(rgb));
                        

                        // color.r = quantize(color.r + threshold.r, uQuantization);
                        // color.g = quantize(color.g + threshold.g, uQuantization);
                        // color.b = quantize(color.b + threshold.b, uQuantization);

                        color.r = quantize(color.r + threshold, uQuantization);
                        color.g = quantize(color.g + threshold, uQuantization);
                        color.b = quantize(color.b + threshold, uQuantization);

                    } else if (uColorMode == 1) { // RGB
                        color.rgb = rgb;

                        color.r = quantize(color.r + threshold, uQuantization);
                        color.g = quantize(color.g + threshold, uQuantization);
                        color.b = quantize(color.b + threshold, uQuantization);

                        // color.r = quantize(color.r + threshold.r, uQuantization);
                        // color.g = quantize(color.g + threshold.g, uQuantization);
                        // color.b = quantize(color.b + threshold.b, uQuantization);

                    } else if (uColorMode == 2) { // Custom Palette
                        color.rgb = vec3(luma(rgb));

                        ivec2 paletteTextureSize = textureSize(uDitherTexture, 0);
                        color = texture(uPaletteTexture, vec2(quantize(1. - (luma(rgb) + threshold), paletteTextureSize.x), 0.0)).rgb;

                        // color.r = texture(uPaletteTexture, vec2(quantize(1. - (luma(rgb) + threshold.r), paletteTextureSize.x), 0.0)).r;
                        // color.g = texture(uPaletteTexture, vec2(quantize(1. - (luma(rgb) + threshold.g), paletteTextureSize.x), 0.0)).r;
                        // color.b = texture(uPaletteTexture, vec2(quantize(1. - (luma(rgb) + threshold.b), paletteTextureSize.x), 0.0)).r;
                    }

                    return color;
                }



                void main() {
                    vec2 pixelSize = uPixelSize / uResolution;
                    vec2 pixelizedUv = floor(vUv / pixelSize) * pixelSize;
                    vec4 color = texture(uTexture, pixelizedUv);

                    fragColor = vec4(orderedDither(color, pixelizedUv), color.a);

                    // float l = grayscale(texture(uDitherTexture, vUv).rgb);

                    // fragColor = vec4(vec3(l), 1.);
                    
                }
                `,
            uniforms: {
                uTexture: { value: texture },
                uResolution: { value: new Vec2(1, 1) },
                uDitherTexture: { value: new Texture(gl) },
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

    set ditheredTexture(value: Texture) {
        this.uniforms.uDitherTexture.value = value
    }
}

const MATRICES = [
    {
        title: "0-8x4-each7px-32lvls",
        id: "0_8x4_EACH_7PX_32LVLS",
        src: "/0-8x4-each7px-32lvls.bmp",
    },
    {
        title: "00XSlayer300_a",
        id: "00X_SLAYER_300_A",
        src: "/00XSlayer300_a.bmp",
    },
    {
        title: "Among Us 16x16",
        id: "AMONG_US_16x16",
        src: "/0AmongUs_16x16.bmp",
    },
    {
        title: "Among Us 16x16 Inverted",
        id: "AMONG_US_16x16_INV",
        src: "/0AmongUs_16x16_inv.bmp",
    },
    {
        title: "Among Us 16x16 v2",
        id: "AMONG_US_16x16_V2",
        src: "/0AmongUs_16x16_v2.bmp",
    },
    {
        title: "Among Us 16x16 v2 (10 Levels)",
        id: "AMONG_US_16x16_V2_10LVL",
        src: "/0AmongUs_16x16_v2_10lvl.bmp",
    },
    {
        title: "Among Us 16x16 v2 Inverted",
        id: "AMONG_US_16x16_V2_INV",
        src: "/0AmongUs_16x16_v2_inv.bmp",
    },
    {
        title: "Among Us 5x6",
        id: "AMONG_US_5x6",
        src: "/0AmongUs_5x6.bmp",
    },
    {
        title: "Among Us 5x6 Inverted",
        id: "AMONG_US_5x6_INV",
        src: "/0AmongUs_5x6_inv.bmp",
    },
    {
        title: "CAT 16x16",
        id: "CAT_16x16",
        src: "/0CAT_A.bmp",
    },
    {
        title: "Stars A",
        id: "STARS_A",
        src: "/0stars_A.bmp",
    },
    {
        title: "Spiral 16x16",
        id: "SPIRAL_16x16",
        src: "/a-spiral-16x16.bmp",
    },
    {
        title: "Toad 16x16 B",
        id: "TOAD_16x16_B",
        src: "/a-toad-16x16-b.bmp",
    },
    {
        title: "Toad 16x16",
        id: "TOAD_16x16",
        src: "/a-toad-16x16.bmp",
    },
    {
        title: "Bayer 4x4",
        id: "BAYER_4x4",
        src: "/bayer4x4.bmp",
    },
    {
        title: "Bayer 8x8",
        id: "BAYER_8x8",
        src: "/bayer8x8.bmp",
    },
    {
        title: "Dot Matrix 5x5",
        id: "DOT_MATRIX_5x5",
        src: "/dot-matrix-5x5.bmp",
    },
    {
        title: "Dot Matrix 6x6 A",
        id: "DOT_MATRIX_6x6_A",
        src: "/dot-matrix-6x6-a.bmp",
    },
    {
        title: "Dot Matrix 6x6 B",
        id: "DOT_MATRIX_6x6_B",
        src: "/dot-matrix-6x6-b.bmp",
    },
    {
        title: "Hearts 6x6",
        id: "HEARTS_6x6",
        src: "/hearts-6x6.bmp",
    },
    {
        title: "Line Diagonal 2x2",
        id: "LINE_DIAG_2x2",
        src: "/line-diag-2x2.bmp",
    },
    {
        title: "Line Diagonal 3x3",
        id: "LINE_DIAG_3x3",
        src: "/line-diag-3x3.bmp",
    },
    {
        title: "Line Diagonal 4x4",
        id: "LINE_DIAG_4x4",
        src: "/line-diag-4x4.bmp",
    },
    {
        title: "Line Diagonal 4x12",
        id: "LINE_DIAG_4x12",
        src: "/line-diag-4x12.bmp",
    },
    {
        title: "Line Diagonal 4x16",
        id: "LINE_DIAG_4x16",
        src: "/line-diag-4x16.bmp",
    },
    {
        title: "Line Diagonal 4x8",
        id: "LINE_DIAG_4x8",
        src: "/line-diag-4x8.bmp",
    },
    {
        title: "Line Diagonal 5x5",
        id: "LINE_DIAG_5x5",
        src: "/line-diag-5x5.bmp",
    },
    {
        title: "Line Diagonal 6x6",
        id: "LINE_DIAG_6x6",
        src: "/line-diag-6x6.bmp",
    },
    {
        title: "Line Diagonal 7x7",
        id: "LINE_DIAG_7x7",
        src: "/line-diag-7x7.bmp",
    },
    {
        title: "Line Diagonal 8x8 (7 Levels)",
        id: "LINE_DIAG_8x8_7LVLS",
        src: "/line-diag-8x8-7lvls.bmp",
    },
    {
        title: "Line Diagonal 8x8 (9 Levels)",
        id: "LINE_DIAG_8x8_9LVLS",
        src: "/line-diag-8x8-9lvls.bmp",
    },
    {
        title: "Line Diagonal Flip 2x2",
        id: "LINE_DIAG_FLIP_2x2",
        src: "/line-diag-flip-2x2.bmp",
    },
    {
        title: "Line Diagonal Flip 3x3",
        id: "LINE_DIAG_FLIP_3x3",
        src: "/line-diag-flip-3x3.bmp",
    },
    {
        title: "Line Diagonal Flip 4x4",
        id: "LINE_DIAG_FLIP_4x4",
        src: "/line-diag-flip-4x4.bmp",
    },
    {
        title: "Line Diagonal Flip 4x8",
        id: "LINE_DIAG_FLIP_4x8",
        src: "/line-diag-flip-4x8.bmp",
    },
    {
        title: "Line Diagonal Flip 4x12",
        id: "LINE_DIAG_FLIP_4x12",
        src: "/line-diag-flip-4x12.bmp",
    },
    {
        title: "Line Diagonal Flip 4x16",
        id: "LINE_DIAG_FLIP_4x16",
        src: "/line-diag-flip-4x16.bmp",
    },
    {
        title: "Line Horizontal 1x2",
        id: "LINE_HORIZ_1x2",
        src: "/line-horiz-1x2.bmp",
    },
    {
        title: "Line Horizontal 1x3",
        id: "LINE_HORIZ_1x3",
        src: "/line-horiz-1x3.bmp",
    },
    {
        title: "Line Horizontal 1x4",
        id: "LINE_HORIZ_1x4",
        src: "/line-horiz-1x4.bmp",
    },
    {
        title: "Line Horizontal 1x5",
        id: "LINE_HORIZ_1x5",
        src: "/line-horiz-1x5.bmp",
    },
    {
        title: "Line Horizontal 1x6",
        id: "LINE_HORIZ_1x6",
        src: "/line-horiz-1x6.bmp",
    },
    {
        title: "Line Horizontal 1x7",
        id: "LINE_HORIZ_1x7",
        src: "/line-horiz-1x7.bmp",
    },
    {
        title: "Line Horizontal 1x8 (7 Levels)",
        id: "LINE_HORIZ_1x8_7LVLS",
        src: "/line-horiz-1x8-7lvls.bmp",
    },
    {
        title: "Line Horizontal 1x8 (9 Levels)",
        id: "LINE_HORIZ_1x8_9LVLS",
        src: "/line-horiz-1x8-9lvls.bmp",
    },
    {
        title: "Line Horizontal Xtra 4x4 Ordered",
        id: "LINE_HORIZ_XTRA_4x4_ORDERED",
        src: "/line-horiz-xtra-4x4-ordered.bmp",
    },
    {
        title: "Line Horizontal Xtra 4x4",
        id: "LINE_HORIZ_XTRA_4x4",
        src: "/line-horiz-xtra-4x4.bmp",
    },
    {
        title: "Line Horizontal Xtra 6x6",
        id: "LINE_HORIZ_XTRA_6x6",
        src: "/line-horiz-xtra-6x6.bmp",
    },
    {
        title: "Line Vertical 2x1",
        id: "LINE_VERT_2x1",
        src: "/line-vert-2x1.bmp",
    },
    {
        title: "Line Vertical 3x1",
        id: "LINE_VERT_3x1",
        src: "/line-vert-3x1.bmp",
    },
    {
        title: "Line Vertical 4x1",
        id: "LINE_VERT_4x1",
        src: "/line-vert-4x1.bmp",
    },
    {
        title: "Line Vertical 5x1",
        id: "LINE_VERT_5x1",
        src: "/line-vert-5x1.bmp",
    },
    {
        title: "Line Vertical 6x1",
        id: "LINE_VERT_6x1",
        src: "/line-vert-6x1.bmp",
    },
    {
        title: "Line Vertical 7x1",
        id: "LINE_VERT_7x1",
        src: "/line-vert-7x1.bmp",
    },
    {
        title: "Line Vertical 8x1 (7 Levels)",
        id: "LINE_VERT_8x1_7LVLS",
        src: "/line-vert-8x1-7lvls.bmp",
    },
    {
        title: "Line Vertical 8x1 (9 Levels)",
        id: "LINE_VERT_8x1_9LVLS",
        src: "/line-vert-8x1-9lvls.bmp",
    },
    {
        title: "Line Vertical Xtra 4x4 Ordered",
        id: "LINE_VERT_XTRA_4x4_ORDERED",
        src: "/line-vert-xtra-4x4-ordered.bmp",
    },
    {
        title: "Line Vertical Xtra 4x4",
        id: "LINE_VERT_XTRA_4x4",
        src: "/line-vert-xtra-4x4.bmp",
    },
    {
        title: "Line Vertical Xtra 6x6",
        id: "LINE_VERT_XTRA_6x6",
        src: "/line-vert-xtra-6x6.bmp",
    },
    {
        title: "Other 3x3 (9 Levels)",
        id: "OTHER_3x3_9LVLS",
        src: "/other-3x3-9lvls.bmp",
    },
    {
        title: "Other 5x5 (5 Levels)",
        id: "OTHER_5x5_5LVLS",
        src: "/other-5x5-5lvls.bmp",
    },
    {
        title: "Triangle 2x2",
        id: "TRIANGLE_2x2",
        src: "/triangle-2x2.bmp",
    },
    {
        title: "Triangle 3x3",
        id: "TRIANGLE_3x3",
        src: "/triangle-3x3.bmp",
    },
    {
        title: "Triangle 4x4",
        id: "TRIANGLE_4x4",
        src: "/triangle-4x4.bmp",
    },
    {
        title: "Triangle 5x5",
        id: "TRIANGLE_5x5",
        src: "/triangle-5x5.bmp",
    },
    {
        title: "Triangle 6x6",
        id: "TRIANGLE_6x6",
        src: "/triangle-6x6.bmp",
    },
    {
        title: "Triangle 7x7",
        id: "TRIANGLE_7x7",
        src: "/triangle-7x7.bmp",
    },
    {
        title: "Triangle 8x8",
        id: "TRIANGLE_8x8",
        src: "/triangle-8x8.bmp",
    },
    {
        title: "Waves 4x16",
        id: "WAVES_4x16",
        src: "/waves-4x16.bmp",
    },
]

export const OrderedDither = forwardRef(function RandomDither(
    { gl, texture }: { gl: OGLRenderingContext; texture: Texture },
    ref
) {
    const [mode, setMode] = useState<string>("BAYER_4x4")
    const [colorMode, setColorMode] = useState(1)
    const [quantization, setQuantization] = useState(3)
    const [isRandom, setIsRandom] = useState(false)
    const [pixelSize, setPixelSize] = useState(2)
    const [colors, setColors] = useState(["#FFFFFF", "#E30613"] as string[])

    const [brightness, setBrightness] = useState(0)

    // useEffect(() => {
    //     const MATRICES = ["/bayer4x4.bmp"]

    //     MATRICES.forEach(file => {
    //         const image = new Image()

    //         image.onload = () => {
    //             const canvas = document.createElement("canvas")
    //             canvas.width = image.width
    //             canvas.height = image.height
    //             const ctx = canvas.getContext("2d")
    //             if (!ctx) return
    //             ctx.drawImage(image, 0, 0)
    //             const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data

    //             console.log(pixels)

    //             // ORDERED_DITHERING_MATRICES[matrix] = pixels
    //         }

    //         image.src = file
    //     })
    // }, [])

    // const { texture: ditherTexture } = useOrderedDitheringTexture(gl, ORDERED_DITHERING_MATRICES[mode])
    const { texture: paletteTexture } = useGradientTexture(gl, colors, quantization)

    const [program] = useState(() => new OrderedDitherMaterial(gl, texture, paletteTexture))

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
                    {/* {Object.entries(ORDERED_DITHERING_MATRICES).map(([key, { title }]) => (
                        <option key={key} value={key}>
                            {title}
                        </option>
                    ))} */}
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
                    onValueChange={value => setQuantization(Number(value))}
                    min={2}
                    max={8}
                    step={1}
                />
            </div>
        </>
    )
})
