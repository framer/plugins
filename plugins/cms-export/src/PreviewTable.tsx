import type { Collection, CollectionItem } from "framer-plugin"

import { framer } from "framer-plugin"
import { useEffect, useRef, useState } from "react"
import { getDataForCSV } from "./csv"

import "./PreviewTable.css"

interface Props {
    collection: Collection
}

export function PreviewTable({ collection }: Props) {
    const container = useRef<HTMLDivElement>(null)
    const content = useRef<HTMLTableElement>(null)

    const [previewCSV, setPreviewCSV] = useState<string[][]>()
    const [showGradient, setShowGradient] = useState(false)

    useEffect(() => {
        framer.showUI({
            width: 340,
            height: 370,
            resizable: false,
        })

        const load = async () => {
            if (!collection) return

            const fields = await collection.getFields()
            const items = await collection.getItems()
            const previewItems: CollectionItem[] = []

            for (let index = 0; index < items.length; index++) {
                previewItems.push(items[index])
            }

            setPreviewCSV(getDataForCSV(collection.slugFieldName, fields, previewItems))
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

    if (!previewCSV?.length) return null

    return (
        <div className="preview-table" ref={container}>
            <div className="preview-table-scrollable">
                <table ref={content}>
                    <thead>
                        <tr>
                            {previewCSV[0].map((cell, columnIndex) => (
                                <td key={`0-${columnIndex}`}>{cell}</td>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {previewCSV.map((row, rowIndex) => {
                            if (rowIndex === 0) return

                            return (
                                <tr key={`${rowIndex}`}>
                                    {row.map((cell, columnIndex) => (
                                        <td key={`${rowIndex}-${columnIndex}`} title={cell}>
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {showGradient && <div className="preview-table-gradient" />}

            <div className="preview-table-border" />
        </div>
    )
}
