import "@radix-ui/themes/styles.css"
import cn from "clsx"
import { framer, type ImageAsset, useIsAllowedTo } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"
import { Upload } from "./dropzone/drag-and-drop"
import { useGLBTexture } from "./hooks/use-glb-texture"
import { useImageTexture } from "./hooks/use-image-texture"
import { useVideoTexture } from "./hooks/use-video-texture"
import { ASCII, type ASCIIRef } from "./materials/ascii"
import { useOGLPipeline } from "./ogl/pipeline"
import { BASE_PATH, getPermissionTitle } from "./utils"

import.meta.hot?.accept(() => {
    import.meta.hot?.invalidate()
})

void framer.showUI({ position: "top right", width: 280, height: 500 })

export const CANVAS_WIDTH = 250
export const DEFAULT_WIDTH = 500

function useSelectedImage() {
    const [selection, setSelection] = useState<ImageAsset | null>(null)

    useEffect(() => {
        return framer.subscribeToImage(setSelection)
    }, [])

    return selection
}

export function App() {
    const framerCanvasImage = useSelectedImage()

    return <ASCIIPlugin framerCanvasImage={framerCanvasImage} />
}

export interface DroppedAsset {
    type: string
    src: string
}

const DEFAUL_ASSET = { type: "glb", src: `${BASE_PATH}/framer.glb` }

function ASCIIPlugin({ framerCanvasImage }: { framerCanvasImage: ImageAsset | null }) {
    const canvasContainerRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [savingInAction, setSavingInAction] = useState<boolean>(false)
    const [droppedAsset, setDroppedAsset] = useState<DroppedAsset | null>()
    const [assetResolution, setAssetResolution] = useState<[number, number]>([DEFAULT_WIDTH, DEFAULT_WIDTH])
    const [exportSize, setExportSize] = useState<number>(DEFAULT_WIDTH)
    const asciiRef = useRef<ASCIIRef | null>(null)
    const { gl, toBytes, program, setProgram, setResolution } = useOGLPipeline()

    const isAllowedToUpsertImage = useIsAllowedTo("addImage", "setImage")

    useEffect(() => {
        asciiRef.current?.setPixelSize(exportSize * 0.02)
    }, [exportSize])

    useImageTexture(
        gl,
        droppedAsset?.src ? (droppedAsset.type === "image" ? droppedAsset.src : undefined) : framerCanvasImage?.url,
        texture => {
            if (!program) return
            program.texture = texture
            setAssetResolution([texture.width, texture.height])
        },
        [program]
    )

    useVideoTexture(
        gl,
        droppedAsset?.type === "video" ? droppedAsset.src : undefined,
        texture => {
            if (!program) return
            program.texture = texture
            setAssetResolution([texture.width, texture.height])
        },
        [program]
    )

    const isPlaceholder = !framerCanvasImage?.url && !droppedAsset?.src

    useGLBTexture(
        gl,
        isPlaceholder
            ? DEFAUL_ASSET.src
            : droppedAsset?.type === "glb" || droppedAsset?.type === "gltf"
              ? droppedAsset.src
              : undefined,
        droppedAsset?.type,
        texture => {
            if (!program) return
            program.texture = texture
            setAssetResolution([texture.width, texture.height])
        },
        [program]
    )

    useEffect(() => {
        if (!canvasContainerRef.current) return

        const aspect = assetResolution[0] / assetResolution[1]
        canvasContainerRef.current.style.width = `${CANVAS_WIDTH}px`
        canvasContainerRef.current.style.height = `${CANVAS_WIDTH / aspect}px`

        setExportSize(Math.min(4000, assetResolution[0]))
    }, [assetResolution])

    useEffect(() => {
        const assetAspect = assetResolution[0] / assetResolution[1]
        setResolution([exportSize, exportSize / assetAspect])
    }, [exportSize, assetResolution])

    const saveEffect = useCallback(() => {
        if (!isAllowedToUpsertImage) return

        const task = async () => {
            const bytes = await toBytes()

            setSavingInAction(true)

            if (droppedAsset || isPlaceholder) {
                await framer.addImage({
                    image: {
                        type: "bytes",
                        bytes: bytes,
                        mimeType: "image/png",
                    },
                })
            } else {
                if (!framerCanvasImage) return

                const originalImage = await framerCanvasImage.getData()

                await framer.setImage({
                    image: {
                        bytes,
                        mimeType: originalImage.mimeType,
                    },
                })
            }

            setSavingInAction(false)
        }

        void task()
    }, [toBytes, framerCanvasImage, droppedAsset, isPlaceholder, isAllowedToUpsertImage])

    // resize observer
    useEffect(() => {
        if (!containerRef.current) return

        const resizeObserver = new ResizeObserver(([entry]) => {
            if (!entry) return
            const borderBoxSize = entry.borderBoxSize[0]
            if (!borderBoxSize) return

            void framer.showUI({ position: "top right", width: 280, height: borderBoxSize.blockSize })
        })

        resizeObserver.observe(containerRef.current)

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    return (
        <div className="container" ref={containerRef}>
            <div className="canvas-container" ref={canvasContainerRef}>
                <div
                    className="canvas"
                    ref={node => {
                        if (node) {
                            node.appendChild(gl.canvas)
                        } else {
                            gl.canvas.remove()
                        }
                    }}
                    onMouseMove={e => {
                        if (droppedAsset?.type === "glb" || droppedAsset?.type === "gltf" || isPlaceholder) {
                            gl.canvas.classList.remove("zoom")
                            return
                        }

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
            </div>
            <div className={cn("gui")}>
                <ASCII
                    ref={node => {
                        if (!node) return
                        asciiRef.current = node
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
                        <option value={CANVAS_WIDTH}>{CANVAS_WIDTH}px</option>
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
                disabled={!isAllowedToUpsertImage}
                title={getPermissionTitle(isAllowedToUpsertImage)}
            >
                {savingInAction ? "Adding..." : "Insert"}
            </button>
        </div>
    )
}
