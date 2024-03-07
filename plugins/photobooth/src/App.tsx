import { useCallback, useRef } from "react"
import { api } from "@framerjs/plugin-api"
import Webcam from "react-webcam"
import { useAnimate } from "framer-motion"
import "./App.css"

export function App() {
    const webcamRef = useRef<any>(null)
    const [scope, animate] = useAnimate()

    const capture = useCallback(async () => {
        const image = webcamRef.current.getScreenshot({
            width: 480,
            height: 360,
        })
        animate(".webcam-flash", { opacity: 1 })

        await api.addImage(image, { name: "selfie" })
        animate(".webcam-flash", { opacity: 0 }, { duration: 0.3 })
    }, [webcamRef])

    return (
        <main ref={scope}>
            <div className="webcam-parent">
                <div className="webcam-flash" />
                <div className="webcam-border" />
                <Webcam
                    className="webcam"
                    ref={webcamRef}
                    mirrored={true}
                    videoConstraints={{ facingMode: "user" }}
                    screenshotFormat="image/jpeg"
                />
            </div>
            <button onClick={capture}>Take Selfie</button>
        </main>
    )
}
