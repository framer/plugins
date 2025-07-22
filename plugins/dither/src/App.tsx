import cn from "clsx"
import { framer, ImageAsset, useIsAllowedTo } from "framer-plugin"
import { Camera, Mesh, Plane, Renderer, Transform } from "ogl"
import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"
import { Upload } from "./dropzone/drag-and-drop"
import { OrderedDither, OrderedDitherMaterial, type OrderedDitherRef } from "./materials/ordered"
import { useImageTexture } from "./use-image-texture"
import { assert, bytesFromCanvas, getPermissionTitle } from "./utils"

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
    const isAllowedToUpsertImage = useIsAllowedTo("addImage", "setImage")

    const canvasContainerRef = useRef<HTMLDivElement>(null)
    const [droppedAsset, setDroppedAsset] = useState<DroppedAsset | null>()
    const [assetResolution, setAssetResolution] = useState<[number, number]>([DEFAULT_WIDTH, DEFAULT_WIDTH])
    const [exportSize, setExportSize] = useState<number>(DEFAULT_WIDTH)
    const [savingInAction, setSavingInAction] = useState<boolean>(false)
    const ditherRef = useRef<OrderedDitherRef | null>(null)

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

    const [program, setProgram] = useState<OrderedDitherMaterial | undefined>()

    const [mesh] = useState(() => new Mesh(gl, { geometry, program }))

    const [resolution, setResolution] = useState([DEFAULT_WIDTH, DEFAULT_WIDTH])

    useEffect(() => {
        if (!program) return
        if (!resolution[0] || !resolution[1]) return
        renderer.setSize(resolution[0], resolution[1])
        program.setResolution(resolution[0], resolution[1])
    }, [renderer, program, resolution])

    useEffect(() => {
        if (!ditherRef.current) return
        ditherRef.current.setPixelSize(exportSize * 0.008)
    }, [exportSize])

    useEffect(() => {
        const assetAspect = assetResolution[0] / assetResolution[1]
        setResolution([exportSize, exportSize / assetAspect])
    }, [exportSize, assetResolution])

    useImageTexture(
        gl,
        droppedAsset?.src ?? image?.url,
        texture => {
            if (!program) return
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

        return () => {
            cancelAnimationFrame(raf)
        }
    }, [render])

    const toBytes = useCallback(async () => {
        // texture.needsUpdate = true
        renderer.render({ scene, camera })

        assert(gl.canvas)
        const bytes = await bytesFromCanvas(gl.canvas)
        assert(bytes)

        return bytes
    }, [renderer, scene, camera, gl, resolution])

    const saveEffect = useCallback(() => {
        if (!isAllowedToUpsertImage) return

        const task = async () => {
            const bytes = await toBytes()

            setSavingInAction(true)

            if (droppedAsset) {
                await framer.addImage({
                    image: {
                        type: "bytes",
                        bytes: bytes,
                        mimeType: "image/png",
                    },
                    preferredImageRendering: "pixelated",
                })
            } else {
                if (!image) return
                const originalImage = await image.getData()

                await framer.setImage({
                    image: {
                        bytes,
                        mimeType: originalImage.mimeType,
                    },
                    preferredImageRendering: "pixelated",
                })
            }

            setSavingInAction(false)
        }

        void task()
    }, [toBytes, image, droppedAsset, isAllowedToUpsertImage])

    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!canvasContainerRef.current) return

        const aspect = assetResolution[0] / assetResolution[1]
        canvasContainerRef.current.style.width = `${DEFAULT_WIDTH}px`
        canvasContainerRef.current.style.height = `${DEFAULT_WIDTH / aspect}px`

        setExportSize(DEFAULT_WIDTH)
    }, [assetResolution])

    useEffect(() => {
        const assetAspect = assetResolution[0] / assetResolution[1]
        setResolution([exportSize, exportSize / assetAspect])
    }, [exportSize, assetResolution])

    useEffect(() => {
        const resizeObserver = new ResizeObserver(([entry]) => {
            if (!entry) return

            const borderBoxSize = entry.borderBoxSize
            if (!borderBoxSize[0]) return

            void framer.showUI({ position: "top right", width: 280, height: borderBoxSize[0].blockSize })
        })

        if (!containerRef.current) return
        resizeObserver.observe(containerRef.current)

        return () => {
            resizeObserver.disconnect()
        }
    }, [renderer, camera])

    const disabled = !(droppedAsset?.src ?? image)

    const uploadRef = useRef<HTMLDivElement>(null)

    return (
        <div className="container" ref={containerRef}>
            <div className={cn("canvas-container", disabled && "empty")} ref={canvasContainerRef}>
                {!disabled ? (
                    <div
                        className="canvas"
                        style={{ display: "block" }}
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
                    <div
                        className="error-container"
                        onClick={() => {
                            uploadRef.current?.click()
                        }}
                    >
                        <p>Select an Image...</p>
                    </div>
                )}
            </div>
            <div className={cn("gui", disabled && "disabled")}>
                <OrderedDither
                    ref={node => {
                        if (!node) return
                        ditherRef.current = node
                        setProgram(node.program)
                    }}
                    gl={gl}
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
                        <option value={Math.min(4000, assetResolution[0])}>
                            Source ({Math.min(4000, assetResolution[0])}px)
                        </option>
                    </select>
                </div>
            </div>
            <div className="asset-buttons">
                <Upload
                    ref={uploadRef}
                    isAllowed={isAllowedToUpsertImage}
                    setDroppedAsset={asset => {
                        if (typeof asset !== "object") return
                        setDroppedAsset(asset)
                    }}
                />
                {droppedAsset && (
                    <button
                        className="clear"
                        onClick={() => {
                            setDroppedAsset(null)
                        }}
                    >
                        Clear
                    </button>
                )}
            </div>
            <button
                onClick={saveEffect}
                className="submit"
                disabled={disabled || !isAllowedToUpsertImage}
                title={getPermissionTitle(isAllowedToUpsertImage)}
            >
                {savingInAction ? "Adding..." : "Insert Image"}
            </button>
        </div>
    )
}
