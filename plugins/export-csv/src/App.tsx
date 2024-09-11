import type { CollectionItem } from "framer-plugin"

import "./App.css"
import { framer } from "framer-plugin"
import { useEffect, useRef, useState } from "react"
import { exportCollectionAsCSV, convertCollectionToCSV, getDataForCSV } from "./csv"

export function App() {
    const container = useRef<HTMLDivElement>(null)
    const content = useRef<HTMLTableElement>(null)
    const filename = useRef<HTMLInputElement>(null)

    const [showGradient, setShowGradient] = useState(false)
    const [collectionName, setCollectionName] = useState<string>()
    const [previewCSV, setPreviewCSV] = useState<string[][]>()

    useEffect(() => {
        framer.showUI({
            title: "Export CSV",
            width: 600,
            height: 370,
            resizable: "width",
        })

        const load = async () => {
            const collection = await framer.getCollection()
            if (!collection) return

            const fields = await collection.getFields()
            const items = await collection.getItems()
            const previewItems: CollectionItem[] = []

            for (let index = 0; index < items.length; index++) {
                previewItems.push(items[index])
            }

            setPreviewCSV(getDataForCSV(fields, previewItems))
            setCollectionName(collection.name)
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
    }, [previewCSV])

    const exportCSV = async () => {
        if (!filename.current) return

        const collection = await framer.getCollection()
        exportCollectionAsCSV(collection, filename.current.value)
    }

    const copyCSVtoClipboard = async () => {
        if (!previewCSV?.length) return

        const collection = await framer.getCollection()
        const csv = await convertCollectionToCSV(collection)

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(csv);
            } else {
                // Fallback method for browsers that don't support clipboard.writeText
                const textArea = document.createElement("textarea");
                textArea.value = csv;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            framer.notify("CSV copied to clipboard", { variant: "success" });
        } catch (error) {
            console.error("Failed to copy CSV:", error);
            framer.notify("Failed to copy CSV to clipboard", { variant: "error" });
        }
    }

    if (!previewCSV?.length) return null

    return (
        <div className="export-collection">
            <div className="table" ref={container}>
                <div className="table-scrollable">
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
                                            <td key={`${rowIndex}-${columnIndex}`}>{cell}</td>
                                        ))}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {showGradient && <div className="gradient" />}
                <div className="preview-watermark">Preview</div>
                <div className="border" />
            </div>

            <div className="actions">
                <input type="text" defaultValue={collectionName} placeholder="Filename" ref={filename} />
                <button onClick={copyCSVtoClipboard}>Copy to Clipboard</button>
                <button className="framer-button-primary" onClick={exportCSV}>
                    Export
                </button>
            </div>
        </div>
    )
}
