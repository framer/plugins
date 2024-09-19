import { ImageAsset, framer } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from "ogl"
import { OrderedDither } from "./materials/ordered"
import cn from "clsx"
import { assert, bytesFromCanvas } from "./utils"
import { Upload } from "./dropzone/drag-and-drop"
import { useImageTexture } from "./use-image-texture"

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

export interface DroppedAsset {
    type: string
    src: string
}

function DitherImage({ image }: { image: ImageAsset | null }) {
    const canvasContainerRef = useRef<HTMLDivElement>(null)
    const [droppedAsset, setDroppedAsset] = useState<DroppedAsset | null>()
    const [assetResolution, setAssetResolution] = useState<[number, number]>([DEFAULT_WIDTH, DEFAULT_WIDTH])
    const [exportSize, setExportSize] = useState<number>(DEFAULT_WIDTH)
    const [savingInAction, setSavingInAction] = useState<boolean>(false)
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

    const [resolution, setResolution] = useState([DEFAULT_WIDTH, DEFAULT_WIDTH])

    useEffect(() => {
        renderer.setSize(resolution[0], resolution[1])
        program?.setResolution?.(resolution[0], resolution[1])
    }, [renderer, program, resolution])

    useEffect(() => {
        ditherRef.current?.setPixelSize(exportSize * 0.009)
    }, [exportSize])

    useEffect(() => {
        const assetAspect = assetResolution[0] / assetResolution[1]
        setResolution([exportSize, exportSize / assetAspect])
    }, [exportSize, assetResolution])

    useImageTexture(
        gl,
        droppedAsset?.src || image?.url,
        texture => {
            program.texture = texture
            setAssetResolution([texture.width, texture.height])
        },
        [program]
    )

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

    const toBytes = useCallback(async () => {
        // texture.needsUpdate = true
        renderer.render({ scene, camera })

        assert(gl.canvas)
        const bytes = await bytesFromCanvas(gl.canvas)
        assert(bytes)

        return bytes
    }, [renderer, scene, camera, gl, resolution])

    const saveEffect = useCallback(async () => {
        const bytes = await toBytes()

        setSavingInAction(true)

        if (droppedAsset) {
            await framer.addImage({
                image: {
                    type: "bytes",
                    bytes: bytes,
                    mimeType: "image/png",
                },
            })
        } else {
            const originalImage = await image.getData()

            await framer.setImage({
                image: {
                    bytes,
                    mimeType: originalImage.mimeType,
                },
            })
        }

        setSavingInAction(false)
    }, [toBytes, image, droppedAsset])

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

    const disabled = !(droppedAsset?.src || image)

    return (
        <div className="container" ref={containerRef}>
            <div className={cn("canvas-container", disabled && "empty")} ref={canvasContainerRef}>
                {!disabled ? (
                    <div
                        className="canvas"
                        style={{
                            display: disabled ? "none" : "block",
                        }}
                        ref={node => {
                            if (node) {
                                node.appendChild(gl.canvas)
                            } else {
                                gl.canvas.remove()
                            }
                        }}
                        onMouseMove={e => {
                            const canvasContainerRect = canvasContainerRef.current?.getBoundingClientRect()

                            if (!canvasContainerRect) return

                            const aspect = assetResolution[0] / assetResolution[1]
                            const canvasRect = {
                                width: exportSize,
                                height: exportSize / aspect,
                            }

                            if (
                                canvasRect.width <= canvasContainerRect.width &&
                                canvasRect.height <= canvasContainerRect.height
                            ) {
                                return
                            }

                            const offsetX = e.nativeEvent.clientX - canvasContainerRect.left
                            const offsetY = e.nativeEvent.clientY - canvasContainerRect.top

                            const xPourcent = offsetX / canvasContainerRect.width
                            const yPourcent = offsetY / canvasContainerRect.height

                            const x = xPourcent * (canvasRect.width - canvasContainerRect.width)
                            const y = yPourcent * (canvasRect.height - canvasContainerRect.height)

                            gl.canvas.style.transform = `translate(${-x}px, ${-y}px)`
                            gl.canvas.classList.add("zoom")
                        }}
                        onMouseLeave={() => {
                            gl.canvas.classList.remove("zoom")
                        }}
                    ></div>
                ) : (
                    <div className="error-container">
                        <p>Select an Image...</p>
                    </div>
                )}
            </div>
            <div className={cn("gui", disabled && "disabled")}>
                <OrderedDither
                    ref={node => {
                        ditherRef.current = node
                        setProgram(node?.program)
                    }}
                    gl={gl}
                    // texture={texture}
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
            <div className="asset-buttons">
                <Upload
                    setDroppedAsset={asset => {
                        setDroppedAsset(asset)
                    }}
                    disabled={false}
                />
                {droppedAsset && (
                    <button className="clear" onClick={() => setDroppedAsset(null)}>
                        Clear
                    </button>
                )}
            </div>
            <button onClick={saveEffect} disabled={disabled} className="submit">
                {savingInAction ? "Adding..." : "Insert Image"}
            </button>
        </div>
    )
}
