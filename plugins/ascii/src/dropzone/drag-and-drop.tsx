import { useState } from "react"
import Dropzone from "react-dropzone"
import type { DroppedAsset } from "../App"
import { getPermissionTitle } from "../utils"

export function Upload({
    setDroppedAsset,
    isAllowed,
}: {
    setDroppedAsset: React.Dispatch<React.SetStateAction<DroppedAsset>>
    isAllowed: boolean
}) {
    const [message, setMessage] = useState<string>("Upload")

    return (
        <Dropzone
            noDrag
            maxFiles={1}
            accept={{
                "image/*": [".png", ".jpeg", ".jpg", ".webp", ".avif"],
                "video/*": [".mp4", ".webm", ".mov"],
                "model/gltf+json": [".gltf"],
                "model/gltf-binary": [".glb"],
            }}
            onDrop={acceptedFiles => {
                const file = acceptedFiles[0]
                if (!file) return

                const url = URL.createObjectURL(file)

                if (file.type.includes("image")) {
                    setDroppedAsset({ type: "image", src: url })
                } else if (file.type.includes("video")) {
                    setDroppedAsset({ type: "video", src: url })
                } else if (/\.glb$/.exec(file.name)) {
                    setDroppedAsset({ type: "glb", src: url })
                } else if (/\.gltf$/.exec(file.name)) {
                    setDroppedAsset({ type: "gltf", src: url })
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
                    <button
                        type="button"
                        className="upload-cta"
                        disabled={!isAllowed}
                        title={getPermissionTitle(isAllowed)}
                    >
                        {message}
                    </button>
                </div>
            )}
        </Dropzone>
    )
}
