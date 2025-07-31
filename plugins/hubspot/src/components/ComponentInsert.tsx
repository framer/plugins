import cx from "classnames"
import { Draggable, framer, useIsAllowedTo } from "framer-plugin"

interface Props {
    url: string
    children: React.ReactNode
    image?: string
    attributes?: Record<string, unknown>
    className?: string
}

export const ComponentInsert = ({ url, image, children, attributes, className }: Props) => {
    const isAllowedToAddComponentInstance = useIsAllowedTo("addComponentInstance")

    return (
        <button
            className={cx("w-full h-full max-h-[32px] p-0 m-0 bg-transparent border-none cursor-pointer", className)}
            onClick={() =>
                void framer.addComponentInstance({
                    url,
                    attributes,
                })
            }
            disabled={!isAllowedToAddComponentInstance}
            title={isAllowedToAddComponentInstance ? undefined : "Insufficient permissions"}
        >
            <Draggable
                data={{
                    type: "componentInstance",
                    previewImage: image,
                    url,
                    attributes,
                }}
            >
                <div className="w-full tile p-2 rounded-lg cursor-pointer">
                    <p className="truncate font-semibold text-left">{children}</p>
                </div>
            </Draggable>
        </button>
    )
}
