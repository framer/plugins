import { OGLRenderingContext, Program, Texture, Vec2 } from "ogl"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { GLSL } from "../glsl"
import { ORDERED_DITHERING_MATRICES } from "../ordered-dithering-matrices"
import { useOrderedDitheringTexture } from "../use-ordered-dithering-texture"
import { Palette } from "../palette"
import { useGradientTexture } from "../use-gradient-texture"
import * as Slider from "@radix-ui/react-slider"

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

                in vec2 vUv;
                out vec4 fragColor;

                uniform sampler2D uTexture;

                void main() {
                    fragColor = texture(uTexture, vUv);
                }
                `,
            uniforms: {
                uTexture: { value: texture },
                uResolution: { value: new Vec2(1, 1) },
                // uDitherTexture: { value: ditherTexture },
                // uPaletteTexture: { value: paletteTexture },
                uPixelSize: { value: 1 },
                uColorMode: { value: 0 },
                uQuantization: { value: 8 },
                uRandom: { value: 0 },
                uBrightness: { value: 0 },
            },
            transparent: true,
        })
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

export const ASCII = forwardRef(function RandomDither(
    { gl, texture }: { gl: OGLRenderingContext; texture: Texture },
    ref
) {
    const [characters, setCharacters] = useState(" .●FR░▒▓█")
    const [colorMode, setColorMode] = useState(1)
    const [quantization, setQuantization] = useState(3)
    const [isRandom, setIsRandom] = useState(false)
    const [pixelSize, setPixelSize] = useState(2)
    const [colors, setColors] = useState([] as string[])
    const [brightness, setBrightness] = useState(0)

    const [program] = useState(() => new ASCIIMaterial(gl, texture))

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
                <label className="gui-label">Pixelation</label>
                <input
                    className="gui-input"
                    type="number"
                    min="1"
                    max="6"
                    value={pixelSize}
                    onChange={e => setPixelSize(Number(e.target.value))}
                />

                <Slider.Root
                    className="SliderRoot"
                    defaultValue={[pixelSize]}
                    min={1}
                    max={6}
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
                <label className="gui-label">Color Mode</label>
                <select
                    onChange={e => {
                        setColorMode(Number(e.target.value))
                    }}
                    className="gui-select"
                    value={colorMode}
                    // defaultValue={colorMode}
                >
                    <option value="0">Grayscale</option>
                    <option value="1">RGB</option>
                    <option value="2">Custom Palette</option>
                </select>
            </div>
            <div className="gui-row">
                <label className="gui-label">Quantization</label>
                <input
                    className="gui-input"
                    type="number"
                    min="2"
                    max="8"
                    value={quantization}
                    onChange={e => setQuantization(parseInt(e.target.value))}
                />

                <Slider.Root
                    className="SliderRoot"
                    // defaultValue={[quantization]}
                    min={2}
                    max={8}
                    step={1}
                    value={[quantization]}
                    onValueChange={value => setQuantization(Number(value))}
                >
                    <Slider.Track className="SliderTrack strokeWidth">
                        <Slider.Range className="SliderRange" />
                    </Slider.Track>
                    <Slider.Thumb className="SliderThumb" />
                </Slider.Root>
            </div>
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
        </>
    )
})
