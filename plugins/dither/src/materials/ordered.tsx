import { OGLRenderingContext, Program, Texture, Vec2 } from "ogl"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { GLSL } from "../glsl"
import { ORDERED_DITHERING_MATRICES } from "../ordered-dithering-matrices"
import { useOrderedDitheringTexture } from "../use-ordered-dithering-texture"

export class OrderedDitherMaterial extends Program {
    constructor(gl: OGLRenderingContext, texture: Texture, ditherTexture: Texture) {
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

                ${GLSL.LUMA}

                // int bayerMatrix4x4[16] = int[16](
                //     0, 8, 2, 10,
                //     12, 4, 14, 6,
                //     3, 11, 1, 9,
                //     15, 7, 13, 5
                // );

                // const mat4x4 bayerMatrix4x4 = mat4x4(
                //     0.0,  8.0,  2.0, 10.0,
                //     12.0, 4.0,  14.0, 6.0,
                //     3.0,  11.0, 1.0, 9.0,
                //     15.0, 7.0,  13.0, 5.0
                // ) / 16.0;

                varying vec2 vUv;

                uniform sampler2D uTexture;
                uniform sampler2D uDitherTexture;
                uniform int uMode;
                uniform vec2 uResolution;


                // vec2 ditherTextureSize = textureSize(uDitherTexture, 0);

                float indexValue() {
                    vec2 coords = mod(vUv * uResolution, 4.) / 4.;

                    return texture2D(uDitherTexture, coords).r;
                }

                vec3 orderedDither(vec2 uv, vec3 rgb) {
                    vec3 color = vec3(0.0);

                    // float threshold = 0.0;

                    // float x = mod( uv.x, 4.);
                    // float y = mod( uv.y, 4.);
                    // threshold = texture2D(uDitherTexture, vec2(x, y)).r;

                    float threshold = indexValue();

                    if (luma(rgb) >= threshold) {
                        color = vec3(1.0);
                    }

                    color = vec3(texture2D(uDitherTexture, mod(gl_FragCoord.xy, 4.) / 4.).r);

                    return color;
                }



                void main() {
                    vec4 color = texture2D(uTexture, vUv);

                    
                    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);

                    gl_FragColor = texture2D(uDitherTexture, vUv);

                    gl_FragColor = vec4(orderedDither(vUv, color.rgb), color.a);
                }
                `,
            uniforms: {
                uTexture: { value: texture },
                uResolution: { value: new Vec2(1, 1) },
                uDitherTexture: { value: ditherTexture },
            },
        })

        this.resolution = this.uniforms.uResolution.value
    }

    set mode(value: number) {
        this.uniforms.uMode.value = value
    }
}

export const OrderedDither = forwardRef(function RandomDither(
    { gl, texture }: { gl: OGLRenderingContext; texture: Texture },
    ref
) {
    const [mode, setMode] = useState("BAYER_4x4")

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
    //     program?.width = width
    //     program?.height = height
    // }, [program,width, height])

    useImperativeHandle(ref, () => ({ program }), [program])

    console.log(mode)

    return (
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
    )
})
