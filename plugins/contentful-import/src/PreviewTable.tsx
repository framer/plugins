import type { Collection, CollectionItem, CollectionField } from "framer-plugin"

import { framer } from "framer-plugin"
import { useEffect, useRef, useState } from "react"

import "./PreviewTable.css"

interface Props {
    collection: Collection
}

export function PreviewTable({ collection }: Props) {
    const container = useRef<HTMLDivElement>(null)
    const content = useRef<HTMLTableElement>(null)

    const [fields, setFields] = useState<CollectionField[]>([])
    const [items, setItems] = useState<CollectionItem[]>([])
    const [showGradient, setShowGradient] = useState(false)

    useEffect(() => {
        framer.showUI({
            width: 340,
            height: 370,
            resizable: false,
        })

        const load = async () => {
            if (!collection) return

            const collectionFields = await collection.getFields()
            const collectionItems = await collection.getItems()
            
            setFields(collectionFields)
            setItems(collectionItems)
        }

        const resize = () => {
            if (!container.current || !content.current) return

            const containerBounds = container.current.getBoundingClientRect()
            const contentBounds = content.current.getBoundingClientRect()

            setShowGradient(containerBounds.height - 25 < contentBounds.height)
        }

        window.addEventListener("resize", resize)

        load()
        resize()

        return () => {
            window.removeEventListener("resize", resize)
        }
    }, [collection])

    if (!fields.length || !items.length) return null

    return (
        <div className="preview-table" ref={container}>
            <div className="preview-table-scrollable">
                <table ref={content}>
                    <thead>
                        <tr>
                            {fields.map((field) => (
                                <td key={field.id}>{field.name}</td>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id}>
                                {fields.map((field) => (
                                    <td key={`${item.id}-${field.id}`}>{String((item as any)[field.id] ?? '')}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showGradient && <div className="preview-table-gradient" />}

            <div className="preview-table-border" />
        </div>
    )
}
