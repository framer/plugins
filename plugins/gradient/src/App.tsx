import { useCallback, useRef } from "react"
import { framer } from '@framerjs/plugin-api'
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { useResolution } from "emulsion/pre"
import { customGlsl } from "emulsion/shaders"
import spectral from "spectral.js"
import { resolveLygia } from "resolve-lygia"
import { useTime, useTransform } from "framer-motion"
import { MotionShaderMesh } from "emulsion"
import * as s from "emulsion/shaders"
import "./App.css"

export const glsl = customGlsl([
    (s) => resolveLygia(s),
    (s) => s.replace('#include "spectral.glsl"', spectral.glsl()),
])

const fragmentShader = glsl`
    uniform float time;
    uniform vec2 resolution;
    varying vec2 vUv;
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    varying float dist;

    uniform sampler2D tex;
    
    ${s.PI}
    ${s.rotateUV}
    ${s.osc}
    ${s.repeat}
    ${s.aastep}


    #include "spectral.glsl"
    #include "lygia/generative/fbm.glsl"
    #include "lygia/generative/noised.glsl"
    #include "lygia/generative/curl.glsl"


    void main() {
        vec2 uv = vUv;

      float amplitude = 1. ;
        float frequency = 10. ;
        float t = sin(-time * 2. * 0.001) * 10.;
        float x = uv.x;
        float y = sin(uv.x * t);


        vec2 rUV = rotateUV(uv, vec2(0.5*y), t *0.05);
        float n = noised(vec3(rUV*1., t * 0.5)).y;

        vec2 d2 = curl(vec2(uv * 5. + t)) * 0.5 + 0.5;

        
        vec3 midColor = spectral_mix(color2, color3, uv.x * 0.7 + n);
        vec3 color = spectral_mix(color1, midColor, n); 
        

        gl_FragColor = vec4(color, 1.0);
    }
`

function Inner(props: any) {
    const {
        color1 = "rgb(250, 170, 0)",
        color2 = "rgb(53, 170, 239)",
        color3 = "rgb(46, 188, 204)",
    } = props

    const realTime = useTime()
    const resolution = useResolution()

    const setTime = 0
    const time = useTransform(realTime, (v: number) => v * 0.1 + setTime)

    return (
        <MotionShaderMesh
            uniforms={{
                time,
                resolution,
                color1,
                color2,
                color3,
            }}
            vertexShader={s.defaultVertex}
            fragmentShader={fragmentShader}
        />
    )
}

export function App() {
    const canvasElement = useRef<HTMLCanvasElement>(null)
    const glContext = useRef<WebGLRenderingContext | null>(null)

    const handleAddImage = useCallback(() => {
        if (!canvasElement.current || !glContext.current) return

        const image = canvasElement.current.toDataURL("image/png")

        framer.addImage({ image, name: "image.png" })
    }, [canvasElement])

    return (
        <>
            <Canvas
                orthographic
                camera={{ near: -190, far: 10000 }}
                ref={canvasElement}
                className="canvas"
                gl={{ preserveDrawingBuffer: true }}
                onCreated={({ gl }) => {
                    glContext.current = gl.getContext()
                }}
            >
                <Inner />
                <OrbitControls />
            </Canvas>
            <button className="add-button" onClick={handleAddImage}>
                Add
            </button>
        </>
    )
}
