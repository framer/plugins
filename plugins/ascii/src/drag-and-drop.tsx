import Dropzone from "react-dropzone"
import { framer, ImageAsset } from "framer-plugin"
import { useState } from "react"
import { DroppedAsset, useSelectedImage } from "./App"
import { GLTFLoader } from "ogl"

export function DragAndDrop({
    setDroppedAsset,
}: {
    setDroppedAsset: React.Dispatch<React.SetStateAction<DroppedAsset>>
}) {
    const framerCanvasImage = useSelectedImage()
    const [message, setMessage] = useState<string>("Drag 'n' drop some files here, or click to select files")

    return (
        <Dropzone
            maxFiles={1}
            accept={{
                "image/*": [".png", ".jpeg", ".jpg"],
                "video/*": [".mp4", ".webm", ".ogg"],
                "model/gltf+json": [".gltf"],
                "model/gltf-binary": [".glb"],
            }}
            onDrop={async acceptedFiles => {
                const file = acceptedFiles[0]

                if (file.type.includes("image")) {
                    await handleImageOnFramer(file, framerCanvasImage, setDroppedAsset)
                } else if (file.type.includes("video")) {
                    handleVideoLocally(file, setDroppedAsset)
                } else if (file.name.match(/\.glb$/)) {
                    handleModelOnFramer(file, setDroppedAsset)
                }
            }}
            onError={error => {
                console.log(error)
                setMessage("Something went wrong please try again")
            }}
        >
            {({ getRootProps, getInputProps }) => (
                <div className="error-container">
                    <div {...getRootProps()}>
                        <input {...getInputProps()} />
                        <p>{message}</p>
                    </div>
                </div>
            )}
        </Dropzone>
    )
}

export function Upload({
    setDroppedAsset,
    disabled = false,
}: {
    setDroppedAsset: React.Dispatch<React.SetStateAction<DroppedAsset>>
    disabled: boolean
}) {
    const framerCanvasImage = useSelectedImage()
    const [message, setMessage] = useState<string>("Upload")

    return (
        <Dropzone
            noDrag
            maxFiles={1}
            accept={{
                "image/*": [".png", ".jpeg", ".jpg"],
                "video/*": [".mp4", ".webm", ".ogg"],
                "model/gltf+json": [".gltf"],
                "model/gltf-binary": [".glb"],
            }}
            onDrop={async acceptedFiles => {
                const file = acceptedFiles[0]

                if (file.type.includes("image")) {
                    await handleImageOnFramer(file, setDroppedAsset)
                } else if (file.type.includes("video")) {
                    handleVideoLocally(file, setDroppedAsset)
                } else if (file.name.match(/\.glb$/)) {
                    handleModelOnFramer(file, setDroppedAsset)
                }
            }}
            onError={error => {
                console.log(error)
                setMessage("Something went wrong please try again")
            }}
        >
            {({ getRootProps, getInputProps }) => (
                <div {...getRootProps()} className="upload">
                    <input {...getInputProps()} />
                    <button type="button" className="upload-cta" disabled={disabled}>
                        {message}
                    </button>
                </div>
            )}
        </Dropzone>
    )
}

async function handleImageOnFramer(file: File, setter: React.Dispatch<React.SetStateAction<DroppedAsset>>) {
    const url = URL.createObjectURL(file)

    setter({ type: "image", asset: url })
}

function handleModelOnFramer(file: File, setter: React.Dispatch<React.SetStateAction<DroppedAsset>>) {
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)
    reader.onload = async function ({ target }) {
        let asset
        asset = GLTFLoader.unpackGLB(target?.result as ArrayBuffer)

        setter({ type: "GLB", asset })
    }
}

function handleVideoLocally(file: File, setter: React.Dispatch<React.SetStateAction<DroppedAsset>>) {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")

    video.muted = true
    video.playsInline = true
    video.setAttribute("playsinline", "playsinline")
    video.loop = true
    video.autoplay = true
    video.src = url

    // Grab first frame
    video.addEventListener(
        "loadedmetadata",
        () => {
            video.currentTime = 0 // Adjust the time if necessary
        },
        { once: true }
    )

    // Create a snapshot to load a framer Image and give user feedback of loading
    video.addEventListener(
        "seeked",
        () => {
            const canvas = document.createElement("canvas")
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const context = canvas.getContext("2d")
            context.drawImage(video, 0, 0, canvas.width, canvas.height)

            // Convert the canvas to a Blob (PNG format)
            canvas.toBlob(async blob => {
                if (blob) {
                    const thumbnailFile = new File([blob], "thumbnail.png", { type: "image/png" })

                    await framer.addImage(thumbnailFile)

                    URL.revokeObjectURL(url)
                } else {
                    console.error("Could not generate thumbnail blob.")
                }
            }, "image/png")
        },
        { once: true }
    )

    setter({ type: "video", asset: video })
}
