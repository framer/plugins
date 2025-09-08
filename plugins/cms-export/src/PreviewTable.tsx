import type { Collection } from "framer-plugin"

import { framer } from "framer-plugin"
import { useEffect, useRef, useState } from "react"
import { getDataForCSV } from "./csv"

import "./PreviewTable.css"

const PREVIEW_ROW_LIMIT = 25

const cellTitleOverrides: Record<string, string> = {
    ":draft": "Is Draft?",
}

interface Props {
    collection: Collection
}

export function PreviewTable({ collection }: Props) {
    const container = useRef<HTMLDivElement>(null)
    const content = useRef<HTMLTableElement>(null)

    const [previewCSV, setPreviewCSV] = useState<string[][]>()
    const [showGradient, setShowGradient] = useState(false)

    useEffect(() => {
        const load = async () => {
            const fields = await collection.getFields()
            const items = await collection.getItems()

            setPreviewCSV(getDataForCSV(collection.slugFieldName, fields, items, PREVIEW_ROW_LIMIT))
        }

        const resize = () => {
            if (!container.current || !content.current) return

            const containerBounds = container.current.getBoundingClientRect()
            const contentBounds = content.current.getBoundingClientRect()

            setShowGradient(containerBounds.height - 25 < contentBounds.height)
        }

        window.addEventListener("resize", resize)

        void load()
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
                            {previewCSV[0]?.map((cell, columnIndex) => (
                                <td key={`0-${columnIndex}`} title={cell}>
                                    {cellTitleOverrides[cell] ?? cell}
                                </td>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {previewCSV.map((row, rowIndex) => {
                            if (rowIndex === 0) return

                            return (
                                <tr key={`${rowIndex}`}>
                                    {row.map((cell, columnIndex) => (
                                        <td key={`${rowIndex}-${columnIndex}`} title={limitTitle(cell)}>
                                            {getFirstLine(cell)}
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

function getFirstLine(text: string) {
    return text.split("\n", 2)[0] || text
}

function limitTitle(text: string) {
    if (text.length <= 500) return text

    return text.substring(0, 500) + "…"
}
