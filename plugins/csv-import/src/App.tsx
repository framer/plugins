import type { Collection } from "framer-plugin"
import { framer, useIsAllowedTo } from "framer-plugin"
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ImportResult, ImportResultItem } from "./csv"
import "./App.css"
import { ImportError, importCSV, parseCSV, processRecords } from "./csv"

function ImportIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none">
            <path
                d="M 9 1.4 C 12.59 1.4 15.5 2.799 15.5 4.525 C 15.5 6.251 12.59 7.65 9 7.65 C 5.41 7.65 2.5 6.251 2.5 4.525 C 2.5 2.799 5.41 1.4 9 1.4 Z M 15.5 8.9 C 15.5 10.626 12.59 12.025 9 12.025 C 5.41 12.025 2.5 10.626 2.5 8.9 C 2.5 8.037 2.5 6.4 2.5 6.4 C 2.5 8.126 5.41 9.525 9 9.525 C 12.59 9.525 15.5 8.126 15.5 6.4 C 15.5 6.4 15.5 8.037 15.5 8.9 Z M 15.5 13.275 C 15.5 15.001 12.59 16.4 9 16.4 C 5.41 16.4 2.5 15.001 2.5 13.275 C 2.5 12.412 2.5 10.775 2.5 10.775 C 2.5 12.501 5.41 13.9 9 13.9 C 12.59 13.9 15.5 12.501 15.5 10.775 C 15.5 10.775 15.5 12.412 15.5 13.275 Z"
                fill="rgb(0, 153, 255)"
            ></path>
        </svg>
    )
}

interface ManageConflictsProps {
    records: ImportResultItem[]
    onAllConflictsResolved: (items: ImportResultItem[]) => void
}

function ManageConflicts({ records, onAllConflictsResolved }: ManageConflictsProps) {
    const [recordsIterator] = useState(() => records.filter(record => record.action === "conflict").values())
    const [currentRecord, setCurrentRecord] = useState(() => recordsIterator.next().value)

    const [applyToAll, setApplyToAll] = useState(false)

    const fixedRecords = useRef<ImportResultItem[]>(records)

    const moveToNextRecord = useCallback(() => {
        const next = recordsIterator.next()
        if (next.done) {
            onAllConflictsResolved(fixedRecords.current)
        } else {
            setCurrentRecord(next.value)
        }
    }, [recordsIterator, onAllConflictsResolved])

    const setAction = useCallback(
        (record: ImportResultItem, action: "onConflictUpdate" | "onConflictSkip") => {
            if (!currentRecord) return

            fixedRecords.current = fixedRecords.current.map(existingRecord => {
                if (existingRecord.slug === record.slug) {
                    return { ...existingRecord, action }
                }
                return existingRecord
            })
        },
        [currentRecord]
    )

    const applyAction = useCallback(
        (action: "onConflictUpdate" | "onConflictSkip") => {
            if (!currentRecord) return

            if (!applyToAll) {
                setAction(currentRecord, action)
                moveToNextRecord()
                return
            }

            let current = currentRecord
            while (true) {
                setAction(current, action)
                const next = recordsIterator.next()
                if (next.done) {
                    onAllConflictsResolved(fixedRecords.current)
                    break
                }
                current = next.value
            }
        },
        [currentRecord, applyToAll, setAction, moveToNextRecord, recordsIterator, onAllConflictsResolved]
    )

    if (!currentRecord) return null

    return (
        <form
            onSubmit={event => {
                event.preventDefault()
                applyAction("onConflictUpdate")
            }}
            className="manage-conflicts"
        >
            <div className="content">
                <div className="message">
                    <span style={{ color: "var(--framer-color-text)", fontWeight: 600 }}>“{currentRecord.slug}”</span>
                    <p>An item with this slug field value already exists in this Collection.</p>
                </div>

                <label className="apply-to-all">
                    <input
                        type="checkbox"
                        id="apply-to-all"
                        checked={applyToAll}
                        onChange={event => {
                            setApplyToAll(event.currentTarget.checked)
                        }}
                    />
                    Apply to all
                </label>
            </div>

            <hr />

            <div className="actions">
                <button
                    type="button"
                    onClick={() => {
                        applyAction("onConflictSkip")
                    }}
                >
                    Skip Item
                </button>
                <button type="submit" className="framer-button-primary">
                    Update Item
                </button>
            </div>
        </form>
    )
}

export function App({ collection }: { collection: Collection | null }) {
    const [collections, setCollections] = useState<Collection[]>([])
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(collection)

    const isAllowedToAddItems = useIsAllowedTo("Collection.addItems")

    const form = useRef<HTMLFormElement>(null)
    const inputOpenedFromImportButton = useRef(false)

    const [result, setResult] = useState<ImportResult | null>(null)

    const itemsWithConflict = useMemo(() => result?.items.filter(item => item.action === "conflict") ?? [], [result])

    const [isDragging, setIsDragging] = useState(false)

    useEffect(() => {
        void framer.showUI({
            width: 260,
            height: 330,
            resizable: false,
        })

        const task = async () => {
            // Only load collections if opened without a collection already selected
            if (collection) return

            try {
                const collections = await framer.getCollections()
                const writableCollections = collections.filter(collection => collection.managedBy === "user")
                setCollections(writableCollections)
            } catch (error) {
                console.error(error)
                framer.notify("Failed to load collections", { variant: "error" })
            }
        }

        void task()
    }, [collection])

    useEffect(() => {
        if (itemsWithConflict.length === 0) {
            return
        }

        void framer.showUI({
            width: 260,
            height: 165,
            resizable: false,
        })
    }, [itemsWithConflict])

    const importItems = useCallback(
        async (result: ImportResult) => {
            if (!selectedCollection) return

            await framer.hideUI()
            await importCSV(selectedCollection, result)
        },
        [selectedCollection]
    )

    const processAndImport = useCallback(
        async (csv: string) => {
            if (!selectedCollection) return
            if (!isAllowedToAddItems) return

            try {
                const csvRecords = await parseCSV(csv)
                if (csvRecords.length === 0) {
                    throw new Error("No records found in CSV")
                }

                const result = await processRecords(selectedCollection, csvRecords)
                setResult(result)

                if (result.items.some(item => item.action === "conflict")) {
                    return
                }

                await importItems(result)
            } catch (error) {
                console.error(error)

                if (error instanceof ImportError || error instanceof Error) {
                    framer.closePlugin(error.message, {
                        variant: "error",
                    })
                    return
                }

                framer.closePlugin("Error processing CSV file. Check console for details.", {
                    variant: "error",
                })
            }
        },
        [isAllowedToAddItems, selectedCollection, importItems]
    )

    useEffect(() => {
        if (!selectedCollection) return
        if (!isAllowedToAddItems) return

        const formElement = form.current
        if (!formElement) return

        const handleDragOver = (event: DragEvent) => {
            event.preventDefault()
            setIsDragging(true)
        }

        const handleDragLeave = (event: DragEvent) => {
            if (!event.relatedTarget) {
                setIsDragging(false)
            }
        }

        const handleDrop = (event: DragEvent) => {
            event.preventDefault()
            setIsDragging(false)

            const file = event.dataTransfer?.files[0]
            if (!file?.name.endsWith(".csv")) return

            const input = document.getElementById("file-input") as HTMLInputElement
            const dataTransfer = new DataTransfer()
            dataTransfer.items.add(file)
            input.files = dataTransfer.files
            formElement.requestSubmit()
        }

        formElement.addEventListener("dragover", handleDragOver)
        formElement.addEventListener("dragleave", handleDragLeave)
        formElement.addEventListener("drop", handleDrop)

        return () => {
            formElement.removeEventListener("dragover", handleDragOver)
            formElement.removeEventListener("dragleave", handleDragLeave)
            formElement.removeEventListener("drop", handleDrop)
        }
    }, [isAllowedToAddItems, selectedCollection])

    useEffect(() => {
        if (!selectedCollection) return
        if (!isAllowedToAddItems) return

        const handlePaste = ({ clipboardData }: ClipboardEvent) => {
            if (!clipboardData) return

            const task = async () => {
                try {
                    const csv = clipboardData.getData("text/plain")
                    if (!csv) return
                    await processAndImport(csv)
                } catch (error) {
                    console.error("Error accessing clipboard data:", error)
                    framer.notify("Unable to access clipboard content", {
                        variant: "error",
                    })
                }
            }

            void task()
        }

        window.addEventListener("paste", handlePaste)

        return () => {
            window.removeEventListener("paste", handlePaste)
        }
    }, [isAllowedToAddItems, processAndImport, selectedCollection])

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            if (!selectedCollection) return
            if (!isAllowedToAddItems) return
            event.preventDefault()

            if (!form.current) throw new Error("Form ref not set")

            const formData = new FormData(form.current)
            const fileValue = formData.get("file")

            if (!fileValue || typeof fileValue === "string") return

            const file = fileValue

            void file.text().then(processAndImport)
        },
        [isAllowedToAddItems, processAndImport, selectedCollection]
    )

    const handleFileChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            if (!selectedCollection) return
            if (!event.currentTarget.files?.[0]) return
            if (inputOpenedFromImportButton.current) {
                form.current?.requestSubmit()
            }
        },
        [selectedCollection]
    )

    const selectCollection = (event: ChangeEvent<HTMLSelectElement>) => {
        const collection = collections.find(collection => collection.id === event.currentTarget.value)
        if (!collection) return

        setSelectedCollection(collection)
    }

    if (result && itemsWithConflict.length > 0) {
        return (
            <ManageConflicts
                records={itemsWithConflict}
                onAllConflictsResolved={resolvedItems => {
                    const updatedItems = result.items.map(
                        item => resolvedItems.find(resolved => resolved.slug === item.slug) ?? item
                    )
                    void importItems({ ...result, items: updatedItems })
                }}
            />
        )
    }

    return (
        <form ref={form} className="import-collection" onSubmit={handleSubmit}>
            <input
                id="file-input"
                type="file"
                name="file"
                className="file-input"
                accept=".csv"
                required
                onChange={handleFileChange}
                disabled={!isAllowedToAddItems}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                }}
            />

            {isDragging && (
                <div className="dropzone dragging">
                    <p>Drop CSV file to import</p>
                </div>
            )}

            {!isDragging && (
                <>
                    <div className="intro">
                        <div className="logo">
                            <ImportIcon />
                        </div>
                        <div className="content">
                            <h2>Upload CSV</h2>
                            <p>Make sure your collection fields in Framer match the names of your CSV fields.</p>
                        </div>
                    </div>

                    {/* Show collection dropdown if opened without a collection already selected */}
                    {!collection && (
                        <select
                            className="collection-select"
                            value={selectedCollection?.id ?? ""}
                            onChange={selectCollection}
                            autoFocus
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
                    )}

                    <button
                        className="framer-button-primary"
                        onClick={event => {
                            event.preventDefault()
                            inputOpenedFromImportButton.current = true

                            const input = document.getElementById("file-input") as HTMLInputElement
                            input.click()
                        }}
                        disabled={!isAllowedToAddItems || !selectedCollection}
                        title={isAllowedToAddItems ? undefined : "Insufficient permissions"}
                    >
                        Upload File
                    </button>
                </>
            )}
        </form>
    )
}
