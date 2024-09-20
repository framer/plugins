import Dropzone from "react-dropzone"
import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import { DroppedAsset } from "../App"

export const Upload = forwardRef(function Upload(
    {
        setDroppedAsset,
        disabled = false,
    }: {
        setDroppedAsset: React.Dispatch<React.SetStateAction<DroppedAsset>>
        disabled: boolean
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
            onDrop={async acceptedFiles => {
                const file = acceptedFiles[0]
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
                    <button ref={buttonRef} type="button" className="upload-cta" disabled={disabled}>
                        {message}
                    </button>
                </div>
            )}
        </Dropzone>
    )
})
