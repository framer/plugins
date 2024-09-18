import Dropzone from "react-dropzone"
import { useState } from "react"
import { DroppedAsset } from "../App"

export function Upload({
    onUpload,
    children,
    className,
}: {
    onUpload: (asset: DroppedAsset) => void
    children: string
    className?: string
}) {
    const [message, setMessage] = useState<string>(children)

    return (
        <Dropzone
            noDrag
            maxFiles={1}
            accept={{
                "image/*": [".png", ".jpeg", ".jpg", ".webp", ".avif"],
            }}
            onDrop={async acceptedFiles => {
                const file = acceptedFiles[0]
                const url = URL.createObjectURL(file)

                if (file.type.includes("image")) {
                    onUpload({ type: "image", src: url })
                }
            }}
            onError={error => {
                console.log(error)
                setMessage("Something went wrong please try again")
            }}
        >
            {({ getRootProps, getInputProps }) => (
                <div {...getRootProps()} className={className}>
                    <input {...getInputProps()} />
                    <p>{message}</p>
                </div>
            )}
        </Dropzone>
    )
}
