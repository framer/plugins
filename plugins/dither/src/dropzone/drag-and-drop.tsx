import { framer } from "framer-plugin"
import { forwardRef, useImperativeHandle, useRef } from "react"
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
                void framer.notify("Something went wrong. Please try again.", { variant: "error" })
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
                        Upload
                    </button>
                </div>
            )}
        </Dropzone>
    )
})
