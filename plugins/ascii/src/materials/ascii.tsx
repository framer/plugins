import { Color, OGLRenderingContext, Program, Texture, Vec2 } from "ogl"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { useCharactersAtlasTexture } from "../use-characters-atlas-texture"
import * as Slider from "@radix-ui/react-slider"
import { GLSL } from "../glsl"
import { SegmentedControl } from "@radix-ui/themes"
import { ColorInput } from "../color-input"

export class ASCIIMaterial extends Program {
    constructor(gl: OGLRenderingContext, texture: Texture) {
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

                    // fragColor = vec4(vec3(1., 0., 0.), 1.);

                    // ascii.rgb *= luma;
                    // ascii.rgb *= color.rgb;
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

                    
                    // fragColor.rgb = ascii.rgb;

                    // if(vUv.x > 0.5) {
                    //     fragColor = vec4(pixelizedUv, 0., 1.);
                    // }

                    // fragColor = texture(uTexture, vUv * uPixelSize);

                    // fragColor = texture(uCharactersAtlasTexture, ((vUv + vec2(7., 0.)) / uCharactersAtlasTextureSize));
                }
                `,
            uniforms: {
                uTexture: { value: texture },
                uResolution: { value: new Vec2(1, 1) },
                uCharactersAtlasTexture: { value: new Texture(gl) },
                uCharactersAtlasTextureSize: { value: new Vec2(1, 1) },
                // uDitherTexture: { value: ditherTexture },
                // uPaletteTexture: { value: paletteTexture },
                uPixelSize: { value: 1 },
                uColorMode: { value: 0 },
                uBackgroundColor: { value: new Color("#000000") },
                uIsTransparent: { value: false },
                // uQuantization: { value: 0 },
                // uRandom: { value: 0 },
                uBrightness: { value: 0 },
                uIsFilled: { value: false },
                uTextColor: { value: new Color("#ffffff") },
            },
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

    set charatersAtlasTexture(value: Texture) {
        this.uniforms.uCharactersAtlasTexture.value = value
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

    // set quantization(value: number) {
    //     this.uniforms.uQuantization.value = Math.floor(value)
    // }

    // set isRandom(value: boolean) {
    //     this.uniforms.uRandom.value = value ? 1 : 0
    // }

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

const FONTS = [
    // "IBM Plex Mono",
    // "Share Tech Mono",
    // "Overpass Mono",
    // "Anonymus Pro",
    // "Arial",
    "Roboto Mono",
    "Courier Prime",
    "Pixelify Sans",
    "Rubik Mono One",
    "Pirata One",
]

export const ASCII = forwardRef(function Ascii({ gl, texture }: { gl: OGLRenderingContext; texture: Texture }, ref) {
    // const [characters, setCharacters] = useState(" ●░▒▓█")
    const [characters, setCharacters] = useState("./FR█")

    const [colorMode, setColorMode] = useState(0)
    // const [isRandom, setIsRandom] = useState(false)
    const [pixelSize, setPixelSize] = useState(8)
    const [textColor, setTextColor] = useState("#ffffff")
    const [brightness, setBrightness] = useState(0)
    const [backgroundColor, setBackgroundColor] = useState("#000000")
    const [font, setFont] = useState(FONTS[0])
    const [isTransparent, setIsTransparent] = useState(false)
    const [isFilled, setIsFilled] = useState(false)

    const [program] = useState(() => new ASCIIMaterial(gl, texture))

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

    // useEffect(() => {
    //     program.quantization = quantization
    // }, [program, quantization])

    // useEffect(() => {
    //     program.isRandom = isRandom
    // }, [program, isRandom])

    useEffect(() => {
        program.pixelSize = pixelSize
    }, [program, pixelSize])

    useEffect(() => {
        program.brightness = brightness * 0.5
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

    useImperativeHandle(ref, () => ({ program }), [program])

    return (
        <>
            <div className="gui-row">
                <label className="gui-label">Characters</label>
                <input
                    className="gui-input"
                    type="text"
                    value={characters}
                    onChange={e => setCharacters(e.target.value)}
                />
            </div>
            <div className="gui-row">
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
            <div className="gui-row">
                <label className="gui-label">Size</label>
                <input
                    className="gui-input"
                    type="number"
                    min="8"
                    max="64"
                    value={pixelSize}
                    onChange={e => setPixelSize(Number(e.target.value))}
                />

                <Slider.Root
                    className="SliderRoot"
                    defaultValue={[pixelSize]}
                    min={8}
                    max={64}
                    step={1}
                    value={[pixelSize]}
                    onValueChange={value => setPixelSize(Number(value))}
                >
                    <Slider.Track className="SliderTrack strokeWidth">
                        <Slider.Range className="SliderRange" />
                    </Slider.Track>
                    <Slider.Thumb className="SliderThumb" />
                </Slider.Root>
            </div>
            <div className="gui-row">
                <label className="gui-label">Brightness</label>
                <input
                    className="gui-input"
                    type="number"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={brightness}
                    onChange={e => setBrightness(Number(e.target.value))}
                />

                <Slider.Root
                    className="SliderRoot"
                    defaultValue={[brightness]}
                    min={-1}
                    max={1}
                    step={0.01}
                    value={[brightness]}
                    onValueChange={value => setBrightness(Number(value))}
                >
                    <Slider.Track className="SliderTrack strokeWidth">
                        <Slider.Range className="SliderRange" />
                    </Slider.Track>
                    <Slider.Thumb className="SliderThumb" />
                </Slider.Root>
            </div>
            <div className="gui-row">
                <label className="gui-label">Fill</label>
                <SegmentedControl.Root
                    defaultValue="true"
                    onValueChange={value => {
                        setIsFilled(value === "true")
                    }}
                    className="gui-segmented-control"
                >
                    <SegmentedControl.Item value="true">Yes</SegmentedControl.Item>
                    <SegmentedControl.Item value="false">No</SegmentedControl.Item>
                </SegmentedControl.Root>
            </div>

            {!isFilled && (
                <div className="gui-row">
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
            <div className="gui-row">
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
                <div className="gui-row">
                    <label className="gui-label">Text Color</label>
                    <ColorInput
                        value={textColor}
                        onChange={value => {
                            setTextColor(value as string)
                        }}
                    />
                </div>
            )}

            {/* <div className="gui-row">
                <label className="gui-label">Export Size</label>
                <select
                    onChange={e => {
                        setFont(e.target.value)
                    }}
                    className="gui-select"
                    value={font}
                >
                    <option value="4x6">248px</option>
                    <option value="5x7">512px</option>
                    <option value="6x8">1024px</option>
                    <option value="6x8">Original</option>
                </select>
            </div> */}
        </>
    )
})
