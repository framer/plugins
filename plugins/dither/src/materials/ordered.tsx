import { OGLRenderingContext, Program, Texture, Vec2 } from "ogl"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { GLSL } from "../glsl"
import { ORDERED_DITHERING_MATRICES } from "../ordered-dithering-matrices"
import { useOrderedDitheringTexture } from "../use-ordered-dithering-texture"

export class OrderedDitherMaterial extends Program {
    constructor(gl: OGLRenderingContext, texture: Texture, ditherTexture: Texture) {
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

                ${GLSL.LUMA}

                in vec2 vUv;
                out vec4 fragColor;

                uniform sampler2D uTexture;
                uniform sampler2D uDitherTexture;
                uniform int uMode;
                uniform vec2 uResolution;
                uniform float uPixelSize;
                // uniform float uDitherPixelSize;


                vec3 orderedDither(vec3 rgb) {
                    vec3 color = vec3(0.0);

                    ivec2 ditherTextureSize = textureSize(uDitherTexture, 0);

                    vec2 fragCoord = (vUv / uPixelSize) * uResolution;
                    float x = float(int(fragCoord.x) % ditherTextureSize.x) / float(ditherTextureSize.x);
                    float y = float(int(fragCoord.y) % ditherTextureSize.y) / float(ditherTextureSize.y);
                    
                    float threshold = texture(uDitherTexture, vec2(x, y)).r;

                    // if (luma(rgb) >= threshold) {
                    //     color = vec3(1.0);
                    // }

                        if(rgb.r >= threshold) {
                            color.r = 1.0;
                        }

                        if(rgb.g >= threshold) {
                            color.g = 1.0;
                        }

                        if(rgb.b >= threshold) {
                            color.b = 1.0;
                        }

                        // color = vec3(texture(uDitherTexture, coords).r);

                    return color;
                }



                void main() {
                    vec2 pixelSize = uPixelSize / uResolution;
                    vec2 pixelizedUv = floor(vUv / pixelSize) * pixelSize;
                    vec4 color = texture(uTexture, pixelizedUv);

                    
                    // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);

                    // gl_FragColor = texture2D(uDitherTexture, vUv);

                    fragColor = vec4(orderedDither(color.rgb), color.a);

                    // fragColor = color;
                }
                `,
            uniforms: {
                uTexture: { value: texture },
                uResolution: { value: new Vec2(1, 1) },
                uDitherTexture: { value: ditherTexture },
                uPixelSize: { value: 1 },
                uDitherPixelSize: { value: 1 },
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

    // set ditherPixelSize(value: number) {
    //     this.uniforms.uDitherPixelSize.value = value
    // }
}

export const OrderedDither = forwardRef(function RandomDither(
    { gl, texture }: { gl: OGLRenderingContext; texture: Texture },
    ref
) {
    const [mode, setMode] = useState("BAYER_4x4")
    // const [pixelSize, setPixelSize] = useState(1)
    // const [ditherPixelSize, setDitherPixelSize] = useState(1)

    const { texture: ditherTexture, canvas } = useOrderedDitheringTexture(gl, ORDERED_DITHERING_MATRICES[mode])

    useEffect(() => {
        document.body.appendChild(canvas)

        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 128px;
            height: 128px;
            pointer-events: none;

        `
    }, [ditherTexture, canvas])

    const [program] = useState(() => new OrderedDitherMaterial(gl, texture, ditherTexture))

    // useEffect(() => {
    //     program.pixelSize = pixelSize
    // }, [program, pixelSize])

    // useEffect(() => {
    //     program.ditherPixelSize = ditherPixelSize
    // }, [program, ditherPixelSize])

    useImperativeHandle(ref, () => ({ program }), [program])

    return (
        <div>
            <div className="gui-row">
                <label className="gui-label">Mode</label>
                <select
                    onChange={e => {
                        setMode(e.target.value)
                    }}
                    className="gui-select"
                    defaultValue={mode}
                >
                    {Object.keys(ORDERED_DITHERING_MATRICES).map(key => (
                        <option key={key} value={key}>
                            {key}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
})
