import * as comlink from "comlink"
import { ImageAsset, framer } from "framer-plugin"
import {
    forwardRef,
    startTransition,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react"
import "./App.css"
import { Spinner } from "./Spinner"
import { assert, bytesFromCanvas } from "./utils"
import type { CanvasWorker } from "./worker/worker"
import Worker from "./worker/worker?worker"
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from "ogl"
import { RandomDither } from "./materials/random"
import { OrderedDither } from "./materials/ordered"

// const WorkerBase = comlink.wrap<typeof CanvasWorker>(new Worker())

void framer.showUI({ position: "top left", width: 280, height: Infinity })

function useSelectedImage() {
    const [image, setImage] = useState<ImageAsset | null>(null)

    useEffect(() => {
        return framer.subscribeToImage(setImage)
    }, [])

    return image
}

export function App() {
    const image = useSelectedImage()

    if (!image) {
        return (
            <div className="error-container">
                <p>Select an Image</p>
            </div>
        )
    }

    // return <ThresholdImage image={image} maxWidth={248} maxHeight={400} />
    return <DitherImage image={image} />
}

// const debounce = (fn: Function, ms = 300) => {
//     let timeoutId: ReturnType<typeof setTimeout>
//     return function (this: any, ...args: any[]) {
//         clearTimeout(timeoutId)
//         timeoutId = setTimeout(() => fn.apply(this, args), ms)
//     }
// }

const CANVAS_WIDTH = 248

function DitherImage({ image }: { image: ImageAsset }) {
    const canvasContainerRef = useRef<HTMLDivElement>(null)

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

    const [type, setType] = useState(1)
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
        if (!image) return
        loadTexture(image)
    }, [image])

    useEffect(() => {
        canvasContainerRef.current?.appendChild(gl.canvas)

        return () => gl.canvas.remove()
    }, [])

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

        framer.hideUI()
        await framer.setImage({
            image: {
                bytes: nextBytes,
                mimeType: originalImage.mimeType,
            },
        })

        void framer.closePlugin("Image saved...")

        console.log("total duration", performance.now() - start)
    }, [render])

    const [pixelSize, setPixelSize] = useState(1)

    useEffect(() => {
        program.pixelSize = pixelSize
    }, [program, pixelSize])

    return (
        <div className="container">
            <div className="canvas-container" ref={canvasContainerRef}>
                {/* {!hasPainted && <Spinner size="medium" />} */}
            </div>

            {/* <input
                type="range"
                min="0"
                max="255"
                // value={threshold}
                // onChange={event => handleThresholdChange(Number(event.target.value))}
            /> */}

            {/* {type === 1 && <OrderedDither />} */}

            <div className="gui-row">
                <label className="gui-label">Type</label>
                <select
                    onChange={e => {
                        setType(Number(e.target.value))
                    }}
                    className="gui-select"
                    defaultValue={type}
                >
                    <option value="0">Random (Noise)</option>
                    <option value="1">Ordered</option>
                </select>
            </div>
            <div className="gui-row">
                <label className="gui-label">Pixelation</label>
                <input
                    type="range"
                    min="1"
                    max="5"
                    value={pixelSize}
                    onChange={e => setPixelSize(Number(e.target.value))}
                    className="gui-select"
                />
            </div>

            {type === 0 && (
                <RandomDither
                    ref={node => {
                        // TODO: fix this type
                        setProgram(node?.program)
                    }}
                    gl={gl}
                    texture={texture}
                />
            )}
            {type === 1 && (
                <OrderedDither
                    ref={node => {
                        // TODO: fix this type
                        setProgram(node?.program)
                    }}
                    gl={gl}
                    texture={texture}
                />
            )}

            <button onClick={saveImage}>Save Image</button>
        </div>
    )
}

// function ThresholdImage({ image, maxWidth, maxHeight }: { image: ImageAsset; maxWidth: number; maxHeight: number }) {
//     const [threshold, setThreshold] = useState(127)
//     const canvasRef = useRef<HTMLCanvasElement>(null)
//     const [hasPainted, setHasPainted] = useState(false)

//     const handleSaveImage = async () => {
//         const ctx = canvasRef.current?.getContext("2d")
//         assert(ctx)

//         const originalImage = await image.getData()

//         assert(canvasRef.current)
//         const nextBytes = await bytesFromCanvas(canvasRef.current)
//         assert(nextBytes)

//         const start = performance.now()

//         framer.hideUI()
//         await framer.setImage({
//             image: {
//                 bytes: nextBytes,
//                 mimeType: originalImage.mimeType,
//             },
//         })

//         void framer.closePlugin("Image saved...")

//         console.log("total duration", performance.now() - start)
//     }

//     const updateCanvas = useMemo(
//         () =>
//             debounce(async (nextThreshold: number) => {
//                 const worker = await new WorkerBase()

//                 const bitmap = await image.loadBitmap()

//                 const canvas = canvasRef.current
//                 assert(canvas)
//                 const ctx = canvas.getContext("2d")
//                 assert(ctx)

//                 const result = await worker.draw(bitmap, nextThreshold)

//                 assert(result)

//                 let displayWidth: number, displayHeight: number

//                 // Calculate the aspect ratios based on max dimensions
//                 const widthRatio = maxWidth / bitmap.width
//                 const heightRatio = maxHeight / bitmap.height

//                 if (widthRatio < heightRatio) {
//                     // Width ratio is smaller, so we'll base dimensions on width to prevent going over maxWidth
//                     displayWidth = maxWidth
//                     displayHeight = bitmap.height * widthRatio
//                 } else {
//                     // Base dimensions on height
//                     displayHeight = maxHeight
//                     displayWidth = bitmap.width * heightRatio
//                 }

//                 assert(ctx)

//                 canvas.width = displayWidth
//                 canvas.height = displayHeight

//                 framer.showUI({
//                     position: "top left",
//                     width: 280,
//                     height: displayHeight + 95,
//                 })

//                 ctx.drawImage(result, 0, 0, displayWidth, displayHeight)

//                 setHasPainted(true)
//             }, 20),
//         [image]
//     )

//     const handleThresholdChange = useCallback(
//         (nextValue: number) => {
//             startTransition(() => {
//                 setThreshold(nextValue)
//                 void updateCanvas(nextValue)
//             })
//         },
//         [updateCanvas]
//     )

//     useEffect(() => {
//         // Start in the middle between 0-255
//         void updateCanvas(127)
//     }, [image])

//     return (
//         <div className="container">
//             <div className="canvas-container">
//                 <canvas ref={canvasRef} />
//                 {!hasPainted && <Spinner size="medium" />}
//             </div>

//             <input
//                 type="range"
//                 min="0"
//                 max="255"
//                 value={threshold}
//                 onChange={event => handleThresholdChange(Number(event.target.value))}
//             />

//             <button onClick={handleSaveImage}>Save Image</button>
//         </div>
//     )
// }
