import Dropzone from "react-dropzone"
import { useState } from "react"

// FramerPluginAPI type not exported
export function DragAndDrop({ framer }: { framer: any }) {
    const [message, setMessage] = useState<String>("Drag 'n' drop some files here, or click to select files")

    async function handleImage(file: File) {
        await framer.addImage(file)
    }

    async function handleVideo(file: File) {
        const uploadedFile = await framer.uploadFile({
            // You can also pass "File" objects
            // To accept <input type="file" /> inputs.
            file,
            name: "Ascii plugin video",
        })

        // Insert a Video Component with the uploaded file
        await framer.addComponentInstance({
            url: "https://framerusercontent.com/modules/lRDHiNWNVWmE0lqtoVHP/Z4QJ2YpzpVnWRfR6Ccgg/Video.js#Video",
            attributes: {
                controls: {
                    srcType: "Upload",
                    srcFile: uploadedFile,
                },
            },
        })
    }

    console.log(framer)

    return (
        <Dropzone
            maxFiles={1}
            accept={{
                "image/*": [".png", ".gif", ".jpeg", ".jpg"],
                "video/*": [".mp4", ".webm", ".ogg", ".mov"],
            }}
            onDrop={async acceptedFiles => {
                console.log(acceptedFiles)
                const file = acceptedFiles[0]

                if (file.type.includes("image")) {
                    await handleImage(file)
                } else if (file.type.includes("video")) {
                    await handleVideo(file)
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
