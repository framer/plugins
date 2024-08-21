import { ImageAsset, framer } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"
// import { Spinner } from "./Spinner"
import { assert, bytesFromCanvas } from "./utils"
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from "ogl"
import { OrderedDither } from "./materials/ordered"
import cn from "clsx"

void framer.showUI({ title: "Dither", position: "top right", width: 280, height: 500 })

function useSelectedImage() {
    const [image, setImage] = useState<ImageAsset | null>(null)

    useEffect(() => {
        return framer.subscribeToImage(setImage)
    }, [])

    return image
}

export function App() {
    const image = useSelectedImage()

    // if (!image) {
    //     return (
    //         <div className="error-container">
    //             <p>Select an Image</p>
    //         </div>
    //     )
    // }
    return <DitherImage image={image} />
}
const CANVAS_WIDTH = 248

function DitherImage({ image }: { image: ImageAsset }) {
    // const canvasContainerRef = useRef<HTMLDivElement>(null)

    const [renderer] = useState(() => new Renderer())
    const gl = renderer.gl

    // cleanup on unmount
    const isMountedRef = useRef(false)
    // useEffect(() => {
    //     if (!isMountedRef.current) {
    //         isMountedRef.current = true
    //     } else {
    //         return () => gl.getExtension("WEBGL_lose_context")?.loseContext()
    //     }
    // }, [])

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

    const [scene] = useState(() => new Transform())
    const [geometry] = useState(() => new Plane(gl))

    // const [type, setType] = useState(1)
    const [program, setProgram] = useState(() => new Program(gl, {}))

    const [mesh] = useState(() => new Mesh(gl, { geometry, program }))

    const [texture] = useState(
        () =>
            new Texture(gl, {
                minFilter: gl.LINEAR,
                magFilter: gl.LINEAR,
            })
    )

    const [resolution, setResolution] = useState([CANVAS_WIDTH, CANVAS_WIDTH])

    useEffect(() => {
        renderer.setSize(resolution[0], resolution[1])
        program?.setResolution?.(resolution[0], resolution[1])
    }, [renderer, program, resolution])

    const loadTexture = useCallback(
        async (image: ImageAsset) => {
            const loadedImage = await image.loadImage() // get blob src to avoid CORS

            const img = new Image()
            img.onload = () => {
                texture.image = img
                const aspect = img.naturalWidth / img.naturalHeight

                setResolution([Math.floor(CANVAS_WIDTH), Math.floor(CANVAS_WIDTH / aspect)])
                texture.update()
            }
            img.src = loadedImage.currentSrc
        },
        [program, renderer, texture]
    )

    useEffect(() => {
        if (image) {
            loadTexture(image)
        } else {
            texture.image = null
            texture.update()
        }
    }, [image])

    // useEffect(() => {
    //     canvasContainerRef.current?.appendChild(gl.canvas)

    //     return () => gl.canvas.remove()
    // }, [])

    useEffect(() => {
        if (!program) return
        mesh.program = program
    }, [program])

    useEffect(() => {
        mesh.setParent(scene)
    }, [mesh, scene])

    const render = useCallback(() => {
        renderer.render({ scene, camera })

        requestAnimationFrame(render)
    }, [renderer, scene, camera])

    useEffect(() => {
        const raf = requestAnimationFrame(render)

        return () => cancelAnimationFrame(raf)
    }, [render])

    const saveImage = useCallback(async () => {
        render()

        const originalImage = await image.getData()

        assert(gl.canvas)
        const nextBytes = await bytesFromCanvas(gl.canvas)
        assert(nextBytes)

        const start = performance.now()

        await framer.addImage({
            image: {
                bytes: nextBytes,
                mimeType: originalImage.mimeType,
            },
        })

        // framer.hideUI()
        // await framer.setImage({
        //     image: {
        //         bytes: nextBytes,
        //         mimeType: originalImage.mimeType,
        //     },
        // })

        // void framer.closePlugin("Image saved...")

        console.log("total duration", performance.now() - start)
    }, [render, image])

    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const resizeObserver = new ResizeObserver(([entry]) => {
            const { inlineSize: width, blockSize: height } = entry.borderBoxSize[0]

            // console.log("resize", width, height)

            void framer.showUI({ title: "Dither", position: "top right", width: 280, height })
        })

        resizeObserver.observe(containerRef.current)

        return () => resizeObserver.disconnect()
    }, [renderer, camera])

    return (
        <div className="container" ref={containerRef}>
            <div className="canvas-container">
                {image ? (
                    <div
                        style={{
                            display: image ? "block" : "none",
                        }}
                        ref={node => {
                            if (node) {
                                node.appendChild(gl.canvas)
                            } else {
                                gl.canvas.remove()
                            }
                        }}
                    ></div>
                ) : (
                    <div className="error-container">
                        <p>Select an Image</p>
                    </div>
                )}
            </div>

            {/* {type === 0 && (
                <RandomDither
                    ref={node => {
                        // TODO: fix this type
                        setProgram(node?.program)
                    }}
                    gl={gl}
                    texture={texture}
                />
            )} */}
            {/* {type === 1 && ( */}
            <div className={cn("gui", !image && "disabled")}>
                <OrderedDither
                    ref={node => {
                        // TODO: fix this type
                        setProgram(node?.program)
                    }}
                    gl={gl}
                    texture={texture}
                />
                {/* )} */}
            </div>
            <button onClick={saveImage} disabled={!image}>
                Add Image
            </button>
        </div>
    )
}
