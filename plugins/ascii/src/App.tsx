import { ImageAsset, framer } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import "@radix-ui/themes/styles.css"
import "./App.css"
import { ASCII } from "./materials/ascii"
import cn from "clsx"
import { Upload } from "./dropzone/drag-and-drop"
import { useOGLPipeline } from "./ogl/pipeline"
import { GLTFDescription } from "ogl"
import { useImageTexture } from "./hooks/use-image-texture"
import { useVideoTexture } from "./hooks/use-video-texture"
import { useGLBTexture } from "./hooks/use-glb-texture"

import.meta.hot?.accept(() => {
    import.meta.hot?.invalidate()
})

void framer.showUI({ title: "ASCII", position: "top right", width: 280, height: 500 })

export const CANVAS_WIDTH = 250
export const DEFAULT_WIDTH = 500

export function useSelectedImage() {
    const [selection, setSelection] = useState<ImageAsset | null>(null)

    useEffect(() => {
        return framer.subscribeToImage(setSelection)
    }, [])

    return selection
}
// export function useSelectedNode() {
//     const [selection, setSelection] = useState<CanvasNode[]>([])

//     useEffect(() => {
//         return framer.subscribeToSelection(setSelection)
//     }, [])

//     return selection
// }

export function App() {
    const framerCanvasImage = useSelectedImage()
    // const selectedNode = useSelectedNode()

    // console.log(selectedNode)

    return <ASCIIPlugin framerCanvasImage={framerCanvasImage} />
}

export interface DroppedAsset {
    type: string
    src: string
}

// { type: "model", src: "/framer_raw.glb" }

const DEFAUL_ASSET = { type: "glb", src: "/framer.glb" }

function ASCIIPlugin({ framerCanvasImage }: { framerCanvasImage: ImageAsset | null }) {
    const canvasContainerRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [savingInAction, setSavingInAction] = useState<boolean>(false)
    // const [droppedAsset, setDroppedAsset] = useState<DroppedAsset | null>(null)
    const [droppedAsset, setDroppedAsset] = useState<DroppedAsset | null>()
    const [assetResolution, setAssetResolution] = useState<[number, number]>([DEFAULT_WIDTH, DEFAULT_WIDTH])
    const [exportSize, setExportSize] = useState<number>(DEFAULT_WIDTH)
    const { gl, toBytes, program, setProgram, setResolution } = useOGLPipeline()

    useImageTexture(
        gl,
        droppedAsset?.src ? undefined : framerCanvasImage?.url,
        texture => {
            program.texture = texture
            setAssetResolution([texture.width, texture.height])
        },
        [program]
    )

    useVideoTexture(
        gl,
        droppedAsset?.type === "video" ? droppedAsset?.src : undefined,
        texture => {
            program.texture = texture
            setAssetResolution([texture.width, texture.height])
        },
        [program]
    )

    const isPlaceholder = !framerCanvasImage?.url && !droppedAsset?.src

    useGLBTexture(
        gl,
        isPlaceholder ? DEFAUL_ASSET.src : droppedAsset?.type === "glb" ? droppedAsset?.src : undefined,
        texture => {
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

        setExportSize(assetResolution[0])
    }, [assetResolution])

    useEffect(() => {
        const assetAspect = assetResolution[0] / assetResolution[1]
        setResolution([exportSize, exportSize / assetAspect])
    }, [exportSize, assetResolution])

    const saveEffect = useCallback(async () => {
        // assert(gl.canvas)
        // setResolution([Math.floor(img.naturalWidth), Math.floor(img.naturalHeight)])
        // gl.canvas.width = img.naturalWidth
        // gl.canvas.height = img.naturalHeight
        const bytes = await toBytes()
        // const nextBytes = await bytesFromCanvas(gl.canvas)
        // assert(bytes)

        // const start = performance.now()
        setSavingInAction(true)

        const originalImage = await framerCanvasImage.getData()

        await framer.setImage({
            image: {
                bytes,
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
    }, [toBytes, framerCanvasImage])

    // resize observer
    useEffect(() => {
        if (!containerRef.current) return

        const resizeObserver = new ResizeObserver(([entry]) => {
            const { inlineSize: width, blockSize: height } = entry.borderBoxSize[0]

            // console.log("resize", width, height)

            void framer.showUI({ title: "ASCII", position: "top right", width: 280, height })
        })

        resizeObserver.observe(containerRef.current)

        return () => resizeObserver.disconnect()
    }, [])

    const [isMouseDown, setIsMouseDown] = useState(false)

    useEffect(() => {
        const handleMouseDown = () => {
            setIsMouseDown(true)
        }

        const handleMouseUp = () => {
            setIsMouseDown(false)
        }

        canvasContainerRef.current?.addEventListener("mousedown", handleMouseDown)
        window.addEventListener("mouseup", handleMouseUp)

        return () => {
            canvasContainerRef.current?.removeEventListener("mousedown", handleMouseDown)
            window.removeEventListener("mouseup", handleMouseUp)
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
                        if ((droppedAsset?.type === "glb" || isPlaceholder) && isMouseDown) {
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
                        <option value={CANVAS_WIDTH}>{CANVAS_WIDTH}px</option>
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
                        // console.log(asset)
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
            <button onClick={saveEffect} className="submit">
                {savingInAction ? "Adding..." : "Insert"}
            </button>
        </div>
    )
}
