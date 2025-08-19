import { framer } from "framer-plugin"
import { Color, type OGLRenderingContext, Program, Texture, Vec2 } from "ogl"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { ColorInput } from "../color-input"
import { GLSL } from "../glsl"
import { useCharactersAtlasTexture } from "../hooks/use-characters-atlas-texture"
import { NumberInput } from "../number-input"
import SegmentedControl from "../segmented-control"

interface Uniforms {
    uTexture: { value: Texture }
    uResolution: { value: Vec2 }
    uCharactersAtlasTexture: { value: Texture }
    uCharactersAtlasTextureSize: { value: Vec2 }
    uPixelSize: { value: number }
    uColorMode: { value: number }
    uBackgroundColor: { value: Color }
    uIsTransparent: { value: boolean }
    uBrightness: { value: number }
    uIsFilled: { value: boolean }
    uTextColor: { value: Color }
}

export class ASCIIMaterial extends Program {
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

                ${GLSL.LUMA}
                ${GLSL.QUANTIZE}
                ${GLSL.BLEND_NORMAL}

                in vec2 vUv;
                out vec4 fragColor;

                uniform sampler2D uTexture;
                uniform sampler2D uCharactersAtlasTexture;
                uniform vec2 uCharactersAtlasTextureSize;

                uniform float uPixelSize;
                uniform vec2 uResolution;
                uniform int uColorMode;
                uniform float uBrightness;
                uniform vec3 uBackgroundColor;
                uniform bool uIsTransparent;
                uniform bool uIsFilled;
                uniform vec3 uTextColor;

                void main() {
                    vec2 pixelSize = uPixelSize / uResolution;
                    vec2 pixelizedUv = floor(vUv / pixelSize) * pixelSize;
                    vec4 color = texture(uTexture, pixelizedUv);

                    float luma = luma(color.rgb);
                    float characterIndex = round(clamp(luma + uBrightness, 0., 1.) * (uCharactersAtlasTextureSize.x - 1.));

                    fragColor = vec4(pixelizedUv, 0., 1.0);
                    
                    vec2 pixelizedMappedUv = mod(vUv / pixelSize, 1.);
                    // fragColor = vec4(pixelizedMappedUv, 0., 1.0);
                    vec4 ascii = texture(uCharactersAtlasTexture, (pixelizedMappedUv + vec2(characterIndex, 0.)) / uCharactersAtlasTextureSize);

                    int maxCharacterIndex = int(uCharactersAtlasTextureSize.x);

                    if(uColorMode == 0) { // RGB
                        ascii.rgb *= color.rgb;
                    } else if(uColorMode == 1) { // RGB (quantized)
                        ascii.r = quantize(color.r, maxCharacterIndex);
                        ascii.g = quantize(color.g, maxCharacterIndex);
                        ascii.b = quantize(color.b, maxCharacterIndex);
                    } else if(uColorMode == 2) { // Grayscale
                        ascii.rgb *= luma; 
                    } else if(uColorMode == 3) { // Grayscale (quantized)
                        ascii.rgb = vec3(quantize(luma, maxCharacterIndex));
                    } else if(uColorMode == 4) { // Custom
                        ascii.rgb = uTextColor;
                    }

                    fragColor = vec4(ascii.rgb, color.a * ascii.a);

                    if(uIsTransparent == false) {
                        fragColor = vec4(blendNormal(uBackgroundColor.rgb, fragColor.rgb, fragColor.a), 1.);
                    }

                    if(uIsFilled == true) {
                        if(uColorMode == 0) { // RGB
                            color.rgb = color.rgb;
                        } else if(uColorMode == 1) { // RGB (quantized)
                            color.r = quantize(color.r, maxCharacterIndex);
                            color.g = quantize(color.g, maxCharacterIndex);
                            color.b = quantize(color.b, maxCharacterIndex);
                        } else if(uColorMode == 2) { // Grayscale
                            color.rgb = vec3(luma); 
                        } else if(uColorMode == 3) { // Grayscale (quantized)
                            color.rgb = vec3(quantize(luma, maxCharacterIndex));
                        }

                        fragColor = vec4(blendNormal(color.rgb, vec3(1.), color.a * ascii.a), color.a);
                    }

                    // fragColor = texture(uTexture, vUv);
                }
                `,
            uniforms: {
                uTexture: { value: new Texture(gl) },
                uResolution: { value: new Vec2(1, 1) },
                uCharactersAtlasTexture: { value: new Texture(gl) },
                uCharactersAtlasTextureSize: { value: new Vec2(1, 1) },
                uPixelSize: { value: 1 },
                uColorMode: { value: 0 },
                uBackgroundColor: { value: new Color("#000000") },
                uIsTransparent: { value: false },
                uBrightness: { value: 0 },
                uIsFilled: { value: false },
                uTextColor: { value: new Color("#ffffff") },
            } satisfies Uniforms,
            transparent: true,
        })
    }

    setResolution(x: number, y: number) {
        this.uniforms.uResolution.value.set(Math.floor(x), Math.floor(y))
    }

    setCharactersAtlasTextureSize(x: number, y: number) {
        this.uniforms.uCharactersAtlasTextureSize.value.x = Math.floor(x)
        this.uniforms.uCharactersAtlasTextureSize.value.y = Math.floor(y)
    }

    set texture(value: Texture) {
        this.uniforms.uTexture.value = value
    }

    set charatersAtlasTexture(value: Texture) {
        this.uniforms.uCharactersAtlasTexture.value = value
    }

    set pixelSize(value: number) {
        this.uniforms.uPixelSize.value = value
    }

    set colorMode(value: number) {
        this.uniforms.uColorMode.value = value
    }

    set brightness(value: number) {
        this.uniforms.uBrightness.value = value
    }

    set backgroundColor(value: string) {
        this.uniforms.uBackgroundColor.value.set(value)
    }

    set isTransparent(value: boolean) {
        this.uniforms.uIsTransparent.value = value
    }

    set isFilled(value: boolean) {
        this.uniforms.uIsFilled.value = value
    }

    set textColor(value: string) {
        this.uniforms.uTextColor.value.set(value)
    }
}

const FONTS = ["Roboto Mono", "Fragment Mono", "Martian Mono", "Space Mono", "Courier Prime"] as const

const DEFAULT_VALUES = {
    characters: " ./FR#",
    colorMode: 0,
    pixelSize: 10,
    textColor: "#ffffff",
    brightness: 0,
    backgroundColor: "#000000",
    font: FONTS[0],
    isFilled: false,
    isTransparent: false,
}

export interface ASCIIRef {
    program: ASCIIMaterial
    setPixelSize: (value: number) => void
}

export const ASCII = forwardRef<ASCIIRef, { gl: OGLRenderingContext }>(function Ascii({ gl }, ref) {
    const [characters, setCharacters] = useState(DEFAULT_VALUES.characters)
    const [colorMode, setColorMode] = useState(DEFAULT_VALUES.colorMode)
    const [pixelSize, setPixelSize] = useState(DEFAULT_VALUES.pixelSize)
    const [textColor, setTextColor] = useState(DEFAULT_VALUES.textColor)
    const [brightness, setBrightness] = useState(DEFAULT_VALUES.brightness)
    const [backgroundColor, setBackgroundColor] = useState(DEFAULT_VALUES.backgroundColor)
    const [font, setFont] = useState<string>(DEFAULT_VALUES.font)
    const [isTransparent, setIsTransparent] = useState(DEFAULT_VALUES.isTransparent)
    const [isFilled, setIsFilled] = useState(DEFAULT_VALUES.isFilled)

    const [program] = useState(() => new ASCIIMaterial(gl))

    const {
        texture: charactersAtlasTexture,
        width: charactersAtlasTextureWidth,
        height: charactersAtlasTextureHeight,
    } = useCharactersAtlasTexture(gl, {
        characters,
        size: 64,
        font,
    })

    useEffect(() => {
        program.charatersAtlasTexture = charactersAtlasTexture
        program.setCharactersAtlasTextureSize(charactersAtlasTextureWidth, charactersAtlasTextureHeight)
    }, [program, charactersAtlasTexture, charactersAtlasTextureWidth, charactersAtlasTextureHeight])

    useEffect(() => {
        program.colorMode = colorMode
    }, [program, colorMode])

    useEffect(() => {
        program.pixelSize = pixelSize
    }, [program, pixelSize])

    useEffect(() => {
        program.brightness = brightness / 200
    }, [program, brightness])

    useEffect(() => {
        program.isTransparent = isTransparent
    }, [program, isTransparent])

    useEffect(() => {
        program.backgroundColor = backgroundColor
    }, [program, backgroundColor])

    useEffect(() => {
        program.isFilled = isFilled
    }, [program, isFilled])

    useEffect(() => {
        program.textColor = textColor
    }, [program, textColor])

    useImperativeHandle(
        ref,
        () => ({
            program,
            setPixelSize: (value: number) => {
                setPixelSize(Math.max(8, Math.min(Math.round(value), 160)))
            },
        }),
        [program, setPixelSize]
    )

    useEffect(() => {
        if (isFilled) setColorMode(0)
    }, [isFilled])

    function onContextMenu(e: React.MouseEvent<HTMLDivElement>, property: keyof typeof DEFAULT_VALUES) {
        e.preventDefault()
        e.stopPropagation()

        let enabled = true
        let onAction: (() => void) | undefined = undefined

        switch (property) {
            case "characters":
                enabled = characters !== DEFAULT_VALUES.characters
                onAction = () => {
                    setCharacters(DEFAULT_VALUES.characters)
                }
                break
            case "font":
                enabled = font !== DEFAULT_VALUES.font
                onAction = () => {
                    setFont(DEFAULT_VALUES.font)
                }
                break
            case "pixelSize":
                enabled = pixelSize !== DEFAULT_VALUES.pixelSize
                onAction = () => {
                    setPixelSize(DEFAULT_VALUES.pixelSize)
                }
                break
            case "brightness":
                enabled = brightness !== DEFAULT_VALUES.brightness
                onAction = () => {
                    setBrightness(DEFAULT_VALUES.brightness)
                }
                break
            case "isFilled":
                enabled = isFilled !== DEFAULT_VALUES.isFilled
                onAction = () => {
                    setIsFilled(false)
                }
                break
            case "backgroundColor":
                enabled = backgroundColor !== DEFAULT_VALUES.backgroundColor || isTransparent
                onAction = () => {
                    setBackgroundColor(DEFAULT_VALUES.backgroundColor)
                    setIsTransparent(false)
                }
                break
            case "colorMode":
                enabled = colorMode !== DEFAULT_VALUES.colorMode
                onAction = () => {
                    setColorMode(DEFAULT_VALUES.colorMode)
                }
                break
            case "textColor":
                enabled = textColor !== DEFAULT_VALUES.textColor
                onAction = () => {
                    setTextColor(DEFAULT_VALUES.textColor)
                }
                break
        }

        framer.showContextMenu(
            [
                {
                    label: "Reset to Default",
                    enabled,
                    onAction,
                },
            ],
            {
                location: {
                    x: e.clientX,
                    y: e.clientY,
                },
            }
        )
    }

    return (
        <>
            <div className="gui-row" onContextMenu={e => onContextMenu(e, "characters")}>
                <label className="gui-label">Characters</label>
                <input
                    className="gui-input"
                    type="text"
                    value={characters}
                    onChange={e => {
                        setCharacters(e.target.value)
                    }}
                />
            </div>
            <div className="gui-row" onContextMenu={e => onContextMenu(e, "font")}>
                <label className="gui-label">Font</label>
                <select
                    onChange={e => {
                        setFont(e.target.value)
                    }}
                    className="gui-select"
                    value={font}
                >
                    {FONTS.map(font => (
                        <option key={font} value={font}>
                            {font}
                        </option>
                    ))}
                </select>
                {/* Font preload */}
                <div
                    style={{
                        visibility: "hidden",
                        position: "absolute",
                    }}
                >
                    {FONTS.map(font => (
                        <span style={{ fontFamily: font }} key={font}>
                            {font}
                        </span>
                    ))}
                </div>
            </div>
            <div className="gui-row" onContextMenu={e => onContextMenu(e, "pixelSize")}>
                <label className="gui-label">Size</label>
                <NumberInput
                    value={pixelSize}
                    onValueChange={value => {
                        setPixelSize(value)
                    }}
                    min={8}
                    max={50}
                    step={1}
                />
            </div>
            <div className="gui-row" onContextMenu={e => onContextMenu(e, "brightness")}>
                <label className="gui-label">Brightness</label>
                <NumberInput
                    value={brightness}
                    onValueChange={value => {
                        setBrightness(value)
                    }}
                    min={-100}
                    max={100}
                    step={1}
                />
            </div>
            <div className="gui-row" onContextMenu={e => onContextMenu(e, "isFilled")}>
                <label className="gui-label">Fill</label>
                <SegmentedControl
                    items={[
                        { value: true, label: "Yes" },
                        { value: false, label: "No" },
                    ]}
                    value={isFilled}
                    onChange={value => {
                        setIsFilled(value)
                    }}
                />
            </div>

            {!isFilled && (
                <div className="gui-row" onContextMenu={e => onContextMenu(e, "backgroundColor")}>
                    <label className="gui-label">Background</label>
                    <ColorInput
                        value={isTransparent ? false : backgroundColor}
                        onChange={value => {
                            if (value) {
                                setBackgroundColor(value as string)
                                setIsTransparent(false)
                            } else {
                                setIsTransparent(true)
                            }
                        }}
                        erasable
                    />
                </div>
            )}
            <div className="gui-row" onContextMenu={e => onContextMenu(e, "colorMode")}>
                <label className="gui-label">Color Mode</label>
                <select
                    onChange={e => {
                        setColorMode(Number(e.target.value))
                    }}
                    className="gui-select"
                    value={colorMode}
                    // defaultValue={colorMode}
                >
                    <option value="0">RGB</option>
                    <option value="1">RGB (quantized)</option>
                    <option value="2">Grayscale</option>
                    <option value="3">Grayscale (quantized)</option>
                    {!isFilled && <option value="4">Solid Color</option>}
                </select>
            </div>

            {[4].includes(colorMode) && (
                <div className="gui-row" onContextMenu={e => onContextMenu(e, "textColor")}>
                    <label className="gui-label">Text Color</label>
                    <ColorInput
                        value={textColor}
                        onChange={value => {
                            setTextColor(value as string)
                        }}
                    />
                </div>
            )}
        </>
    )
})
