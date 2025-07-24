import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import Dropzone from "react-dropzone"
import type { DroppedAsset } from "../App"
import { getPermissionTitle } from "../utils"

export const Upload = forwardRef(function Upload(
    {
        setDroppedAsset,
        isAllowed,
    }: {
        setDroppedAsset: React.Dispatch<React.SetStateAction<DroppedAsset>>
        isAllowed: boolean
    },
    ref
) {
    const [message, setMessage] = useState<string>("Upload")
    const buttonRef = useRef<HTMLButtonElement>(null)

    useImperativeHandle(ref, () => ({
        click: () => {
            buttonRef.current?.click()
        },
    }))

    return (
        <Dropzone
            noDrag
            maxFiles={1}
            accept={{
                "image/*": [".png", ".jpeg", ".jpg", ".webp", ".avif"],
            }}
            onDrop={acceptedFiles => {
                const file = acceptedFiles[0]
                if (!file) return

                const url = URL.createObjectURL(file)

                if (file.type.includes("image")) {
                    setDroppedAsset({ type: "image", src: url })
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
                        ref={buttonRef}
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
})
