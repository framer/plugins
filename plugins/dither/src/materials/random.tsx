import { OGLRenderingContext, Program, Texture } from "ogl"
import { GLSL } from "../glsl"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"

class RandomDitherMaterial extends Program {
    constructor(gl: OGLRenderingContext, texture: Texture, mode: number = 0, threshold: number = 127) {
        super(gl, {
            vertex: /*glsl*/ `
                precision highp float;
                
                attribute vec3 position;
                attribute vec2 uv;

                varying vec2 vUv;

                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;

                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
                `,
            fragment: /*glsl*/ `
                precision highp float;

                ${GLSL.RANDOM}
                ${GLSL.LUMA}

                vec3 randomDither(vec2 uv, vec3 rgb, int mode) {
                    vec3 color = vec3(0.0);

                    float randomValue = random(uv);

                    if(mode == 0) {
                        if (luma(rgb) >= randomValue) {
                            color = vec3(1.0);
                        }
                    } else if(mode == 1) {
                        if(rgb.r >= randomValue) {
                            color.r = 1.0;
                        }

                        if(rgb.g >= randomValue) {
                            color.g = 1.0;
                        }

                        if(rgb.b >= randomValue) {
                            color.b = 1.0;
                        }
                    }
                    
                    return color;
                }

                varying vec2 vUv;

                uniform sampler2D uTexture;
                uniform int uMode;

                void main() {
                    vec4 color = texture2D(uTexture, vUv);

                    gl_FragColor = vec4(randomDither(vUv, color.rgb, uMode), color.a);
                    // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
                }
                `,
            uniforms: {
                uTexture: { value: texture },
                uMode: { value: mode },
                uThreshold: { value: threshold },
            },
        })
    }

    set mode(value: number) {
        this.uniforms.uMode.value = value
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
                <option value="1">Color</option>
            </select>
        </div>
    )
})
