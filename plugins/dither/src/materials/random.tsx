import { OGLRenderingContext, Program, Texture, Vec2 } from "ogl"
import { GLSL } from "../glsl"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"

class RandomDitherMaterial extends Program {
    constructor(gl: OGLRenderingContext, texture: Texture, mode: number = 0, threshold: number = 127) {
        super(gl, {
            vertex: /*glsl*/ `#version 300 es
                precision highp float;
                
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
                precision highp float;

                ${GLSL.RANDOM}
                ${GLSL.LUMA}

                in vec2 vUv;
                out vec4 fragColor;

                uniform sampler2D uTexture;
                uniform int uMode;
                uniform float uPixelSize;
                uniform vec2 uResolution;

                vec3 randomDither(vec2 uv, vec3 rgb, int mode) {
                    vec3 color = vec3(0.0);

                    float threshold = random(uv * 2.); // * 2. avoid glitches do not ask me why

                    if(mode == 0) {
                        if (luma(rgb) >= threshold) {
                            color = vec3(1.0);
                        }
                    } else if(mode == 1) {
                        if(rgb.r >= threshold) {
                            color.r = 1.0;
                        }

                        if(rgb.g >= threshold) {
                            color.g = 1.0;
                        }

                        if(rgb.b >= threshold) {
                            color.b = 1.0;
                        }
                    }
                    
                    return color;
                }


                
                

                void main() {
                    vec2 pixelSize = uPixelSize / uResolution;
                    vec2 pixelizedUv = floor(vUv / pixelSize) * pixelSize;
                    vec4 color = texture(uTexture, pixelizedUv);

                    fragColor = vec4(randomDither(pixelizedUv, color.rgb, uMode), color.a);
                    // fragColor = color;
                    // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
                }
                `,
            uniforms: {
                uTexture: { value: texture },
                uMode: { value: mode },
                uThreshold: { value: threshold },
                uResolution: { value: new Vec2(1, 1) },
                uPixelSize: { value: 1 },
            },
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
}

export const RandomDither = forwardRef(function RandomDither(
    { gl, texture }: { gl: OGLRenderingContext; texture: Texture },
    ref
) {
    const [mode, setMode] = useState(0)

    const [program] = useState(() => new RandomDitherMaterial(gl, texture, mode))

    useEffect(() => {
        program.mode = mode
    }, [program, mode])

    useImperativeHandle(ref, () => ({ program }), [program])

    return (
        <div className="gui-row">
            <label className="gui-label">Mode</label>
            <select
                onChange={e => {
                    setMode(Number(e.target.value))
                }}
                className="gui-select"
                defaultValue={mode}
            >
                <option value="0">Black and White</option>
                <option value="1">RGB</option>
                <option value="1">Grayscale</option>
                <option value="2">Colors</option>
            </select>
        </div>
    )
})
