import type { Collection } from "framer-plugin"

import "./App.css"
import { framer } from "framer-plugin"
import { ChangeEvent, useEffect, useState } from "react"
import { exportCollectionAsCSV, convertCollectionToCSV } from "./csv"
import { PreviewTable } from "./PreviewTable"
import splashImageSrc from "./assets/splash.png"

export function App() {
    const [isLoading, setIsLoading] = useState(true)
    const [collections, setCollections] = useState<Collection[]>([])
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)

    useEffect(() => {
        framer.showUI({
            width: 340,
            height: 370,
            resizable: false,
        })

        Promise.all([framer.getCollections(), framer.getActiveCollection()]).then(([collections, activeCollection]) => {
            setIsLoading(false)
            setCollections(collections)
            setSelectedCollection(activeCollection)
        })
    }, [])

    const exportCSV = async () => {
        if (!selectedCollection) return

        exportCollectionAsCSV(selectedCollection, selectedCollection.name)
    }

    const copyCSVtoClipboard = async () => {
        if (!selectedCollection) return

        const csv = await convertCollectionToCSV(selectedCollection)

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(csv)
            } else {
                // Fallback method for browsers that don't support clipboard.writeText
                const textArea = document.createElement("textarea")
                textArea.value = csv
                document.body.appendChild(textArea)
                textArea.select()
                document.execCommand("copy")
                document.body.removeChild(textArea)
            }
            framer.notify("CSV copied to clipboard", { variant: "success" })
        } catch (error) {
            console.error("Failed to copy CSV:", error)
            framer.notify("Failed to copy CSV to clipboard", { variant: "error" })
        }
    }

    const selectCollection = (event: ChangeEvent<HTMLSelectElement>) => {
        const collection = collections.find(collection => collection.id === event.currentTarget.value)
        if (!collection) return

        setSelectedCollection(collection)
    }

    return (
        <div className="export-collection">
            <div className="preview-container">
                <div className={`preview-container-image ${!selectedCollection && !isLoading ? "visible" : ""}`}>
                    <div className="empty-state">
                        <img className="empty-state-image" src={splashImageSrc} alt="" />
                        <p className="empty-state-message">Export all your CMS content to CSV files.</p>
                    </div>
                </div>

                <div className={`preview-container-table ${selectedCollection ? "visible" : ""}`}>
                    {selectedCollection && <PreviewTable collection={selectedCollection} />}
                </div>
            </div>

            <div className="footer">
                <select
                    onChange={selectCollection}
                    className={!selectedCollection ? "footer-select footer-select--unselected" : "footer-select"}
                    value={selectedCollection?.id ?? ""}
                >
                    <option value="" disabled>
                        Select Collection…
                    </option>

                    {collections.map(collection => (
                        <option key={collection.id} value={collection.id}>
                            {collection.name}
                        </option>
                    ))}
                </select>

                <div className="footer-actions">
                    <button disabled={!selectedCollection} onClick={copyCSVtoClipboard}>
                        Copy
                    </button>
                    <button disabled={!selectedCollection} onClick={exportCSV}>
                        Export
                    </button>
                </div>
            </div>
        </div>
    )
}
