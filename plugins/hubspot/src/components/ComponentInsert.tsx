import { Draggable, framer } from "framer-plugin"

interface Props {
    url: string
    children: React.ReactNode
    image?: string
    attributes?: Record<string, unknown>
}

export const ComponentInsert = ({ url, image, children, attributes }: Props) => (
    <Draggable
        data={{
            type: "componentInstance",
            previewImage: image,
            url,
            attributes,
        }}
    >
        <button
            className="w-full h-full p-0 m-0 bg-transparent border-none cursor-pointer"
            onClick={() =>
                framer.addComponentInstance({
                    url,
                    attributes,
                })
            }
        >
            {children}
        </button>
    </Draggable>
)
