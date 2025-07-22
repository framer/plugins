import { framer, useIsAllowedTo } from "framer-plugin"
import { useAnimate } from "motion/react"
import { useCallback, useRef } from "react"
import Webcam from "react-webcam"

import "./App.css"

export function App() {
    const isAllowedToUpsertImage = useIsAllowedTo("addImage", "setImage")

    const webcamRef = useRef<Webcam>(null)
    const [scope, animate] = useAnimate()

    const capture = useCallback(() => {
        if (!isAllowedToUpsertImage) return
        if (!webcamRef.current) return

        const image = webcamRef.current.getScreenshot({ width: 1280, height: 720 })
        if (!image) return

        animate(".webcam-flash", { opacity: 1 })

        const task = async () => {
            const imageData = await getAssetDataFromUrl(image)

            const mode = framer.mode
            if (mode === "image" || mode === "editImage") {
                await framer.setImage({ image: imageData, name: "selfie" })
                await framer.closePlugin()
            } else {
                await framer.addImage({ image: imageData, name: "selfie" })
            }

            animate(".webcam-flash", { opacity: 0 }, { duration: 0.3 })
        }

        void task()
    }, [isAllowedToUpsertImage, webcamRef])

    return (
        <main ref={scope}>
            <div className="webcam-parent">
                <div className="webcam-flash" />
                <div className="webcam-border" />
                <div className="webcam-inner-wrapper">
                    <Webcam
                        className="webcam"
                        ref={webcamRef}
                        width={1280}
                        height={720}
                        mirrored={true}
                        videoConstraints={{ facingMode: "user" }}
                        screenshotFormat="image/jpeg"
                    />
                </div>
            </div>
            <button
                onClick={capture}
                disabled={!isAllowedToUpsertImage}
                title={isAllowedToUpsertImage ? undefined : "Insufficient permissions"}
            >
                Take Selfie
            </button>
        </main>
    )
}

async function getAssetDataFromUrl(url: string) {
    const response = await fetch(url)
    const blob = await response.blob()

    const type = response.headers.get("Content-Type")
    if (!type) {
        throw new Error("Unknown content-type for file at URL")
    }

    if (!type.startsWith("image/")) {
        throw new Error("Invalid image type")
    }

    const bytes = await new Response(blob).arrayBuffer().then(buffer => new Uint8Array(buffer))

    return {
        mimeType: type,
        bytes,
    }
}
