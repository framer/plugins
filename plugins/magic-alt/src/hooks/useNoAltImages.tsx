import { FrameNode, framer } from "framer-plugin"
import { useEffect, useState } from "react"

export type FrameNodeWithImage = FrameNode & {
    backgroundImage: NonNullable<FrameNode["backgroundImage"]>
}

export function useNoAltImages() {
    const [images, setImages] = useState<FrameNodeWithImage[]>([])

    useEffect(() => {
        let active = true

        async function run() {
            const imageNodes = await framer.getNodesWithAttributeSet("backgroundImage")
            const imagesWithoutAlt = imageNodes.filter(
                node => node.backgroundImage != null && !node.backgroundImage.altText
            )

            if (!active) return
            setImages(imagesWithoutAlt as FrameNodeWithImage[])
        }

        run()

        return () => {
            active = false
        }
    }, [])

    return [images, setImages] as const
}
