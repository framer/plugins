import { useCallback, useEffect, useRef, useState } from "react"
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from "ogl"
import { assert, bytesFromCanvas } from "../utils"
import { DEFAULT_WIDTH } from "../App"

export function useOGLPipeline() {
    const isMountedRef = useRef(false)
    // const useFBORef = useRef(false)
    const [resolution, setResolution] = useState<[number, number]>([DEFAULT_WIDTH, DEFAULT_WIDTH])
    const [renderer] = useState(() => new Renderer({ alpha: true }))
    const gl = renderer.gl

    //config
    const [scene] = useState(() => new Transform())
    const [geometry] = useState(() => new Plane(gl))
    const [program, setProgram] = useState(() => new Program(gl, {}))
    const [mesh] = useState(() => new Mesh(gl, { geometry, program }))
    const [camera] = useState(
        () =>
            new Camera(gl, {
                left: -0.5,
                right: 0.5,
                bottom: -0.5,
                top: 0.5,
                near: 0.01,
                far: 100,
            })
    )
    camera.position.z = 1

    // const [texture] = useState(
    //     () =>
    //         new Texture(gl, {
    //             minFilter: gl.LINEAR,
    //             magFilter: gl.LINEAR,
    //         })
    // )

    // useImgTexture(texture, droppedAsset, () => {
    //     useFBORef.current = false
    //     program.uniforms.uTexture.value = texture
    // })
    // useVideoTexture(texture, droppedAsset, () => {
    //     useFBORef.current = false
    //     program.uniforms.uTexture.value = texture
    // })
    // useGLBTexture(droppedAsset, () => {
    //     loadModel(droppedAsset.asset)
    //     useFBORef.current = true
    // })

    useEffect(() => {
        renderer.setSize(resolution[0], resolution[1])
        program?.setResolution?.(resolution[0], resolution[1])
    }, [renderer, program, resolution])

    useEffect(() => {
        if (!program) return
        mesh.program = program
    }, [program])

    useEffect(() => {
        mesh.setParent(scene)
    }, [mesh, scene])

    const render = useCallback(() => {
        window.dispatchEvent(
            new CustomEvent("gl:beforerender", {
                detail: { scene, camera },
            })
        )

        renderer.render({ scene, camera }) // Render to screen

        window.dispatchEvent(new CustomEvent("gl:afterrender"))
    }, [renderer, scene, camera, program])

    const toBytes = useCallback(async () => {
        // texture.needsUpdate = true
        renderer.render({ scene, camera })

        assert(gl.canvas)
        const bytes = await bytesFromCanvas(gl.canvas)
        assert(bytes)

        return bytes
    }, [renderer, scene, camera, gl, resolution])

    // cleanup on unmount
    useEffect(() => {
        if (!isMountedRef.current) {
            isMountedRef.current = true
        } else {
            return () => gl.getExtension("WEBGL_lose_context")?.loseContext()
        }
    }, [])

    // Subscribe to raf
    useEffect(() => {
        let raf: number

        function update() {
            render()
            raf = requestAnimationFrame(update)
        }

        raf = requestAnimationFrame(update)

        return () => cancelAnimationFrame(raf)
    }, [render])

    return {
        gl,
        // texture,
        resolution,
        render,
        toBytes,
        program,
        setProgram,
        setResolution,
    }
}
