import { ImageAsset, framer } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import "@radix-ui/themes/styles.css"
import "./App.css"
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from "ogl"
import { ASCII } from "./materials/ascii"
import cn from "clsx"
import { assert, bytesFromCanvas } from "./utils"
import { DragAndDrop } from "./drag-and-drop"

import.meta.hot?.accept(() => {
    import.meta.hot?.invalidate()
})

void framer.showUI({ title: "ASCII", position: "top right", width: 280, height: 500 })
const CANVAS_WIDTH = 248

export function useSelectedImage() {
    const [framerCanvasImage, setFramerCanvasImage] = useState<ImageAsset | null>(null)

    useEffect(() => {
        return framer.subscribeToImage(setFramerCanvasImage)
    }, [])

    return framerCanvasImage
}

export function App() {
    const framerCanvasImage = useSelectedImage()

    return <ASCIIPlugin framerCanvasImage={framerCanvasImage} />
}

export interface DroppedAsset {
    type: string
    asset: any
}

function ASCIIPlugin({ framerCanvasImage }: { framerCanvasImage: ImageAsset | null }) {
    const canvasContainerRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [savingInAction, setSavingInAction] = useState<boolean>(false)
    const [droppedAsset, setDroppedAsset] = useState<DroppedAsset>({ type: "image", asset: framerCanvasImage })
    const { gl, texture, render, setProgram, loadImgTexture, loadVideoTexture, clearTexture } =
        useOGLPipeline(containerRef)

    useEffect(() => {
        if (!framerCanvasImage) {
            clearTexture()
            return
        }

        if (droppedAsset.type === "image") {
            loadImgTexture(framerCanvasImage)
        } else if (droppedAsset.type === "video") {
            loadVideoTexture(droppedAsset.asset)
        }
    }, [droppedAsset, framerCanvasImage])

    const saveEffect = useCallback(async () => {
        const originalImage = await framerCanvasImage.getData()

        assert(gl.canvas)
        render()
        const nextBytes = await bytesFromCanvas(gl.canvas)
        assert(nextBytes)

        // const start = performance.now()
        setSavingInAction(true)

        await framer.setImage({
            image: {
                bytes: nextBytes,
                mimeType: originalImage.mimeType,
            },
        })
        setSavingInAction(false)

        // framer.hideUI()
        // await framer.setImage({
        //     image: {
        //         bytes: nextBytes,
        //         mimeType: originalImage.mimeType,
        //     },
        // })
        // void framer.closePlugin("Image saved...")

        // console.log("total duration", performance.now() - start)
    }, [render, framerCanvasImage])

    return (
        <div className="container" ref={containerRef}>
            <div className="canvas-container" ref={canvasContainerRef}>
                {framerCanvasImage ? (
                    <div
                        className="canvas"
                        style={{
                            display: framerCanvasImage ? "block" : "none",
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
                    <DragAndDrop setDroppedAsset={setDroppedAsset} />
                )}
            </div>
            <div className={cn("gui", !framerCanvasImage && "disabled")}>
                <ASCII
                    ref={node => {
                        setProgram(node?.program)
                    }}
                    gl={gl}
                    texture={texture}
                />
            </div>
            <button onClick={saveEffect} disabled={!framerCanvasImage} className="submit">
                {savingInAction ? "Adding..." : "   Add Image"}
            </button>
        </div>
    )
}

function useOGLPipeline(containerRef: RefObject<HTMLDivElement>) {
    const isMountedRef = useRef(false)
    const [resolution, setResolution] = useState([CANVAS_WIDTH, CANVAS_WIDTH])
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
    const [texture] = useState(
        () =>
            new Texture(gl, {
                minFilter: gl.LINEAR,
                magFilter: gl.LINEAR,
            })
    )

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

    const loadImgTexture = useCallback(
        async (image: ImageAsset) => {
            const loadedImage = await image.loadImage() // get blob src to avoid CORS

            const img = new Image()
            img.onload = () => {
                texture.image = img
                const aspect = img.naturalWidth / img.naturalHeight
                setResolution([Math.floor(CANVAS_WIDTH), Math.floor(CANVAS_WIDTH / aspect)])
                // setResolution([Math.floor(img.naturalWidth), Math.floor(img.naturalHeight)])
                // gl.canvas.width = img.naturalWidth
                // gl.canvas.height = img.naturalHeight
            }
            img.src = loadedImage.currentSrc
        },
        [program, renderer, texture]
    )

    const loadVideoTexture = useCallback(
        async (video: DroppedAsset["asset"]) => {
            video.play()

            if (!texture.image || texture.image.src !== video.src) {
                texture.image = video
                const aspect = video.videoWidth / video.videoHeight
                setResolution([Math.floor(CANVAS_WIDTH), Math.floor(CANVAS_WIDTH / aspect)])
            }
        },
        [gl, texture]
    )

    const clearTexture = useCallback(() => {
        texture.image = undefined
        texture.update()
    }, [texture])

    const render = useCallback(() => {
        texture.needsUpdate = true
        renderer.render({ scene, camera })

        requestAnimationFrame(render)
    }, [renderer, scene, camera, texture])

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
        const raf = requestAnimationFrame(render)

        return () => cancelAnimationFrame(raf)
    }, [render])

    // resize observer
    useEffect(() => {
        const resizeObserver = new ResizeObserver(([entry]) => {
            const { inlineSize: width, blockSize: height } = entry.borderBoxSize[0]

            // console.log("resize", width, height)

            void framer.showUI({ title: "ASCII", position: "top right", width: 280, height })
        })

        resizeObserver.observe(containerRef.current)

        return () => resizeObserver.disconnect()
    }, [renderer, camera])

    return { gl, texture, render, setProgram, loadImgTexture, loadVideoTexture, clearTexture }
}
