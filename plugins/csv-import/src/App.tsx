import type { Collection } from "framer-plugin"

import "./App.css"
import { framer } from "framer-plugin"
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { processRecords, parseCSV, importCSV, type ImportResult, type ImportResultItem } from "./csv"

const importGuideURL = "https://www.framer.com/learn/cms-import/"

function ImportIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
            <path
                d="M 40 15.556 C 51.046 15.556 60 20.033 60 25.556 C 60 31.078 51.046 35.556 40 35.556 C 28.954 35.556 20 31.078 20 25.556 C 20 20.033 28.954 15.556 40 15.556 Z M 60 39.556 C 60 45.078 51.046 49.556 40 49.556 C 28.954 49.556 20 45.078 20 39.556 C 20 36.794 20 31.556 20 31.556 C 20 37.078 28.954 41.556 40 41.556 C 51.046 41.556 60 37.078 60 31.556 C 60 31.556 60 36.794 60 39.556 Z M 60 53.556 C 60 59.078 51.046 63.556 40 63.556 C 28.954 63.556 20 59.078 20 53.556 C 20 50.794 20 45.556 20 45.556 C 20 51.078 28.954 55.556 40 55.556 C 51.046 55.556 60 51.078 60 45.556 C 60 45.556 60 50.794 60 53.556 Z"
                fill="#09f"
            />
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

    const moveToNextRecord = () => {
        const next = recordsIterator.next()
        if (next.done) {
            onAllConflictsResolved(fixedRecords.current)
        } else {
            setCurrentRecord(next.value)
        }
    }

    const setAction = (record: ImportResultItem, action: "onConflictUpdate" | "onConflictSkip") => {
        if (!currentRecord) return

        fixedRecords.current = fixedRecords.current.map(existingRecord => {
            if (existingRecord.slug === record.slug) {
                return { ...existingRecord, action }
            }
            return existingRecord
        })
    }

    const applyAction = async (action: "onConflictUpdate" | "onConflictSkip") => {
        if (!currentRecord) return

        if (!applyToAll) {
            setAction(currentRecord, action)
            moveToNextRecord()
            return
        }

        let current = currentRecord
        do {
            setAction(current, action)
            const next = recordsIterator.next()
            if (next.done) {
                onAllConflictsResolved(fixedRecords.current)
                break
            }
            current = next.value
        } while (current)
    }

    if (!currentRecord) return null

    return (
        <form
            onSubmit={async event => {
                event.preventDefault()
                await applyAction("onConflictUpdate")
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
                        onChange={event => setApplyToAll(event.currentTarget.checked)}
                    />
                    Apply to all
                </label>
            </div>

            <hr />

            <div className="actions">
                <button type="button" onClick={async () => applyAction("onConflictSkip")}>
                    Skip Item
                </button>
                <button type="submit" className="framer-button-primary">
                    Update Item
                </button>
            </div>
        </form>
    )
}

export function App({ collection }: { collection: Collection }) {
    const form = useRef<HTMLFormElement>(null)
    const inputOpenedFromImportButton = useRef(false)

    const [result, setResult] = useState<ImportResult | null>(null)

    const itemsWithConflict = useMemo(() => result?.items.filter(item => item.action === "conflict") ?? [], [result])

    const [isDragging, setIsDragging] = useState(false)

    useEffect(() => {
        framer.showUI({
            width: 300,
            height: 336,
            resizable: false,
        })
    }, [])

    useEffect(() => {
        if (itemsWithConflict.length === 0) {
            return
        }

        framer.showUI({
            width: 260,
            height: 165,
            resizable: false,
        })
    }, [itemsWithConflict])

    useEffect(() => {
        if (!form.current) return

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault()
            setIsDragging(true)
        }

        const handleDragLeave = (e: DragEvent) => {
            if (!e.relatedTarget) {
                setIsDragging(false)
            }
        }

        const handleDrop = async (e: DragEvent) => {
            e.preventDefault()
            setIsDragging(false)

            const file = e.dataTransfer?.files[0]
            if (!file || !file.name.endsWith(".csv")) return

            const input = document.getElementById("file-input") as HTMLInputElement
            const dataTransfer = new DataTransfer()
            dataTransfer.items.add(file)
            input.files = dataTransfer.files
            form.current?.requestSubmit()
        }

        form.current?.addEventListener("dragover", handleDragOver)
        form.current?.addEventListener("dragleave", handleDragLeave)
        form.current?.addEventListener("drop", handleDrop)

        return () => {
            form.current?.removeEventListener("dragover", handleDragOver)
            form.current?.removeEventListener("dragleave", handleDragLeave)
            form.current?.removeEventListener("drop", handleDrop)
        }
    }, [])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const formData = new FormData(form.current!)
        const file = formData.get("file") as File

        const csv = await file.text()

        try {
            const csvRecords = await parseCSV(csv)
            if (csvRecords.length === 0) {
                throw new Error("No records found in CSV")
            }

            const result = await processRecords(collection, csvRecords)
            setResult(result)

            if (result.items.some(item => item.action === "conflict")) {
                return
            }

            await importItems(result)
        } catch (error) {
            console.error(error)
            framer.notify("An error occurred while processing the CSV file. Checkout the logs", {
                variant: "error",
            })
        }
    }

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (!event.currentTarget.files?.[0]) return
        if (inputOpenedFromImportButton.current) {
            form.current?.requestSubmit()
        }
    }

    const importItems = async (result: ImportResult) => {
        await framer.hideUI()
        await importCSV(collection, result)
    }

    if (result && itemsWithConflict.length > 0) {
        return (
            <ManageConflicts
                records={itemsWithConflict}
                onAllConflictsResolved={resolvedItems => {
                    const updatedItems = result.items.map(item => {
                        const resolvedItem = resolvedItems.find(resolved => resolved.slug === item.slug)
                        return resolvedItem || item
                    })
                    importItems({ ...result, items: updatedItems })
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
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                }}
            />

            {isDragging && <div className="dropzone dragging">{isDragging && <p>Drop CSV file to import</p>}</div>}

            {!isDragging && (
                <>
                    <div className="dropzone">
                        <ImportIcon />
                    </div>
                    <ol className="ordered-list">
                        <li>
                            <a
                                href={importGuideURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontWeight: 600 }}
                            >
                                Read the guide
                            </a>{" "}
                            and prepare your data
                        </li>
                        <li>Set up your Collection fields in Framer to match the names of your CSV fields</li>
                        <li>Upload your CSV</li>
                    </ol>
                    <button
                        className="framer-button-primary"
                        onClick={event => {
                            event.preventDefault()
                            inputOpenedFromImportButton.current = true

                            const input = document.getElementById("file-input") as HTMLInputElement
                            input.click()
                        }}
                    >
                        Upload File
                    </button>
                </>
            )}
        </form>
    )
}
