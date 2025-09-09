import type { Collection } from "framer-plugin"

import { framer } from "framer-plugin"
import { type ChangeEvent, useEffect, useState } from "react"
import "./App.css"
import splashImageSrc from "./assets/splash.png"
import { convertCollectionToCSV, exportCollectionAsCSV } from "./csv"
import { PreviewTable } from "./PreviewTable"

export function App() {
    const [isLoading, setIsLoading] = useState(true)
    const [collections, setCollections] = useState<Collection[]>([])
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
    const [copyLoading, setCopyLoading] = useState(false)
    const [exportLoading, setExportLoading] = useState(false)

    useEffect(() => {
        void framer.showUI({
            width: 340,
            height: 370,
            resizable: false,
        })

        const task = async () => {
            const [collections, activeCollection] = await Promise.all([
                framer.getCollections(),
                framer.getActiveCollection(),
            ])

            setIsLoading(false)
            setCollections(collections)
            setSelectedCollection(activeCollection)
        }

        void task()
    }, [])

    const exportCSV = () => {
        if (!selectedCollection) return

        const task = async () => {
            setExportLoading(true)

            try {
                await exportCollectionAsCSV(selectedCollection, selectedCollection.name)
            } catch (error) {
                console.error("Failed to export CSV:", error)
                framer.notify("Failed to export CSV", { variant: "error" })
            }

            setExportLoading(false)
        }

        void task()
    }

    const copyCSVtoClipboard = () => {
        if (!selectedCollection) return

        const task = async () => {
            setCopyLoading(true)

            const csv = await convertCollectionToCSV(selectedCollection)

            try {
                await navigator.clipboard.writeText(csv)
                framer.notify("CSV copied to clipboard", { variant: "success" })
            } catch (error) {
                console.error("Failed to copy CSV:", error)
                framer.notify("Failed to copy CSV to clipboard", { variant: "error" })
            }

            setCopyLoading(false)
        }

        void task()
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
                        {copyLoading ? <div className="framer-spinner" /> : "Copy"}
                    </button>
                    <button disabled={!selectedCollection} onClick={exportCSV}>
                        {exportLoading ? <div className="framer-spinner" /> : "Export"}
                    </button>
                </div>
            </div>
        </div>
    )
}
