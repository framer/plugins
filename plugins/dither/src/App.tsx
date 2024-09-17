import { ImageAsset, framer } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from "ogl"
import { OrderedDither } from "./materials/ordered"
import cn from "clsx"
import { assert, bytesFromCanvas } from "./utils"

if (import.meta.env.DEV) {
    import.meta.hot?.accept(() => {
        import.meta.hot?.invalidate()
    })
}

void framer.showUI({ position: "top right", width: 280, height: 500 })

function useSelectedImage() {
    const [image, setImage] = useState<ImageAsset | null>(null)

    useEffect(() => {
        return framer.subscribeToImage(setImage)
    }, [])

    return image
}

export function App() {
    const image = useSelectedImage()

    return <DitherImage image={image} />
}
const DEFAULT_WIDTH = 250

function DitherImage({ image }: { image: ImageAsset | null }) {
    const canvasContainerRef = useRef<HTMLDivElement>(null)
    const [assetResolution, setAssetResolution] = useState<[number, number]>([DEFAULT_WIDTH, DEFAULT_WIDTH])
    const [exportSize, setExportSize] = useState<number>(DEFAULT_WIDTH)
    const ditherRef = useRef()

    const [renderer] = useState(() => new Renderer({ alpha: true }))
    const gl = renderer.gl

    // cleanup on unmount
    const isMountedRef = useRef(false)
    useEffect(() => {
        if (!isMountedRef.current) {
            isMountedRef.current = true
        } else {
            return () => gl.getExtension("WEBGL_lose_context")?.loseContext()
        }
    }, [])

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

    const [program, setProgram] = useState(() => new Program(gl, {}))

    const [mesh] = useState(() => new Mesh(gl, { geometry, program }))

    const [texture] = useState(
        () =>
            new Texture(gl, {
                minFilter: gl.LINEAR,
                magFilter: gl.LINEAR,
            })
    )

    const [resolution, setResolution] = useState([DEFAULT_WIDTH, DEFAULT_WIDTH])

    useEffect(() => {
        renderer.setSize(resolution[0], resolution[1])
        program?.setResolution?.(resolution[0], resolution[1])
    }, [renderer, program, resolution])

    useEffect(() => {
        ditherRef.current?.setPixelSize(exportSize * 0.01)
    }, [exportSize])

    const loadTexture = useCallback(
        async (image: ImageAsset) => {
            const loadedImage = await image.loadImage() // get blob src to avoid CORS

            const img = new Image()
            img.onload = () => {
                texture.image = img
                const aspect = img.naturalWidth / img.naturalHeight

                setAssetResolution([img.naturalWidth, img.naturalHeight])
                setResolution([Math.floor(DEFAULT_WIDTH), Math.floor(DEFAULT_WIDTH / aspect)])

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

        await framer.setImage({
            image: {
                bytes: nextBytes,
                mimeType: originalImage.mimeType,
            },
        })

        if (import.meta.env.DEV) {
            console.log("total duration", performance.now() - start)
        }
    }, [render, image])

    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!canvasContainerRef.current) return

        const aspect = assetResolution[0] / assetResolution[1]
        canvasContainerRef.current.style.width = `${DEFAULT_WIDTH}px`
        canvasContainerRef.current.style.height = `${DEFAULT_WIDTH / aspect}px`

        setExportSize(assetResolution[0])
    }, [assetResolution])

    useEffect(() => {
        const assetAspect = assetResolution[0] / assetResolution[1]
        setResolution([exportSize, exportSize / assetAspect])
    }, [exportSize, assetResolution])

    useEffect(() => {
        const resizeObserver = new ResizeObserver(([entry]) => {
            const { blockSize: height } = entry.borderBoxSize[0]

            void framer.showUI({ position: "top right", width: 280, height })
        })

        resizeObserver.observe(containerRef.current)

        return () => resizeObserver.disconnect()
    }, [renderer, camera])

    return (
        <div className="container" ref={containerRef}>
            <div className="canvas-container" ref={canvasContainerRef}>
                {image ? (
                    <div
                        className="canvas"
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
                        <p>Select an Image...</p>
                    </div>
                )}
            </div>
            <div className={cn("gui", !image && "disabled")}>
                <OrderedDither
                    ref={node => {
                        ditherRef.current = node
                        setProgram(node?.program)
                    }}
                    gl={gl}
                    texture={texture}
                />
                <div className="gui-row">
                    <label className="gui-label">Resolution</label>
                    <select
                        value={exportSize}
                        className="gui-select"
                        onChange={e => {
                            const value = Number(e.target.value)
                            setExportSize(value)
                        }}
                    >
                        <option value={DEFAULT_WIDTH}>{DEFAULT_WIDTH}px</option>
                        <option value="500">500px</option>
                        <option value="1000">1000px</option>
                        <option value="2000">2000px</option>
                        <option value={assetResolution[0]}>Source ({assetResolution[0]}px)</option>
                    </select>
                </div>
            </div>
            <button onClick={saveImage} disabled={!image}>
                Add Image
            </button>
        </div>
    )
}
