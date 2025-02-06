import type { Collection } from "framer-plugin"

import "./App.css"
import { framer } from "framer-plugin"
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { processRecords, parseCSV, type ImportResult, type ImportResultItem } from "./csv"
// import { exportCollectionAsCSV, convertCollectionToCSV } from "./csv"
// import { PreviewTable } from "./PreviewTable"

const TOAST_DURATION = 5000
const importGuideURL = "https://www.framer.com/learn/cms-import/"

interface ManageConflictsProps {
    records: ImportResultItem[]
    onDone: (items: ImportResultItem[]) => void
}

function ManageConflicts({ records, onDone }: ManageConflictsProps) {
    const [recordsIterator] = useState(() => records.filter(record => record.action === "conflict").values())
    const [currentRecord, setCurrentRecord] = useState(() => recordsIterator.next().value)

    const [applyToAll, setApplyToAll] = useState(false)

    const fixedRecords = useRef<ImportResultItem[]>(records)

    const moveToNextRecord = () => {
        const next = recordsIterator.next()
        if (next.done) {
            onDone(fixedRecords.current)
        } else {
            setCurrentRecord(next.value)
        }
    }

    const applyAction = async (action: "onConflictUpdate" | "onConflictSkip") => {
        if (!currentRecord) return

        if (!applyToAll) {
            fixedRecords.current = fixedRecords.current.map(record => {
                if (record.slug === currentRecord.slug) {
                    return { ...record, action }
                }
                return record
            })
            moveToNextRecord()
        } else {
            let current = currentRecord
            do {
                fixedRecords.current = fixedRecords.current.map(record => {
                    if (record.slug === current.slug) {
                        return { ...record, action }
                    }
                    return record
                })

                const next = recordsIterator.next()
                if (next.done) {
                    onDone(fixedRecords.current)
                    break
                }
                current = next.value
            } while (current)
        }
    }

    if (!currentRecord) return null

    return (
        <form
            onSubmit={async event => {
                event.preventDefault()
                await applyAction("onConflictUpdate")
            }}
            className="import-collection"
        >
            <div className="conflict-item">
                <p>
                    An item with the slug <span style={{ fontWeight: "bold" }}>{currentRecord.slug}</span> already
                    exists
                </p>

                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        id="apply-to-all"
                        checked={applyToAll}
                        onChange={event => setApplyToAll(event.currentTarget.checked)}
                    />
                    Apply to all
                </label>
            </div>

            <div className="footer-actions">
                <button type="button" onClick={async () => applyAction("onConflictSkip")}>
                    Skip Item
                </button>
                <button type="submit">Update Item</button>
            </div>
        </form>
    )
}

export function App() {
    const form = useRef<HTMLFormElement>(null)
    const inputOpenedFromImportButton = useRef(false)

    const [collections, setCollections] = useState<Collection[]>([])
    const [wasStartedInACollection, setWasStartedInACollection] = useState(false)
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)

    const [fileName, setFileName] = useState<string | null>(null)
    const [result, setResult] = useState<ImportResult | null>(null)

    const [importing, setImporting] = useState(false)

    const itemsWithConflict = useMemo(() => result?.items.filter(item => item.action === "conflict") ?? [], [result])

    useEffect(() => {
        framer.showUI({
            width: 340,
            height: 370,
            resizable: false,
        })

        Promise.all([framer.getCollections(), framer.getActiveCollection()]).then(([collections, activeCollection]) => {
            setCollections(collections)
            setWasStartedInACollection(!!activeCollection)
            setSelectedCollectionId(activeCollection?.id ?? null)
        })
    }, [])

    useEffect(() => {
        if (itemsWithConflict.length > 0) {
            framer.showUI({
                height: 150,
                resizable: false,
            })
        }
    }, [itemsWithConflict])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedCollectionId) return

        const collection = await framer.getCollection(selectedCollectionId)
        if (!collection) return

        const formData = new FormData(form.current!)
        const file = formData.get("file") as File

        const csv = await file.text()
        const csvRecords = await parseCSV(csv)

        const result = await processRecords(collection, csvRecords)
        setResult(result)

        if (result.items.some(item => item.action === "conflict")) {
            return
        }

        await handleImportDone(result)
    }

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0]
        if (!file) return setFileName(null)
        setFileName(file.name)
        if (inputOpenedFromImportButton.current) {
            form.current?.requestSubmit()
        }
    }

    const handleImportDone = async (result: ImportResult) => {
        if (!selectedCollectionId) return
        setImporting(true)
        const collection = await framer.getCollection(selectedCollectionId)
        if (!collection) return

        const totalItems = result.items.length
        const totalAdded = result.items.filter(item => item.action === "add").length
        const totalUpdated = result.items.filter(item => item.action === "onConflictUpdate").length
        const totalSkipped = result.items.filter(item => item.action === "onConflictSkip").length
        if (totalItems !== totalAdded + totalUpdated + totalSkipped) {
            throw new Error("Total items mismatch")
        }

        await collection.addItems(
            result.items
                .filter(item => item.action !== "onConflictSkip")
                .map(item =>
                    item.action === "add"
                        ? {
                              slug: item.slug!,
                              fieldData: item.fieldData,
                          }
                        : {
                              id: item.id!,
                              fieldData: item.fieldData,
                          }
                )
        )

        const textMessages: string[] = []
        if (totalAdded > 0) {
            textMessages.push(`Added ${totalAdded} ${totalAdded === 1 ? "item" : "items"}`)
        }
        if (totalUpdated > 0) {
            textMessages.push(`Updated ${totalUpdated} ${totalUpdated === 1 ? "item" : "items"}`)
        }
        if (totalSkipped > 0) {
            textMessages.push(`Skipped ${totalSkipped} ${totalSkipped === 1 ? "item" : "items"}`)
        }

        const text = textMessages.length > 1 ? `${textMessages.join(". ")}.` : textMessages[0]

        if (result.warnings.missingSlugCount > 0) {
            framer.notify(
                `Skipped ${result.warnings.missingSlugCount} ${
                    result.warnings.missingSlugCount === 1 ? "item" : "items"
                } because of missing slug field.`,
                {
                    variant: "warning",
                    durationMs: TOAST_DURATION,
                }
            )
        }
        if (result.warnings.doubleSlugCount > 0) {
            framer.notify(
                `Skipped ${result.warnings.doubleSlugCount} ${
                    result.warnings.doubleSlugCount === 1 ? "item" : "items"
                } because of duplicate slug.`,
                {
                    variant: "warning",
                    durationMs: TOAST_DURATION,
                }
            )
        }

        const { skippedValueCount, skippedValueKeys } = result.warnings
        if (skippedValueCount > 0) {
            framer.notify(
                `Skipped ${skippedValueCount} ${skippedValueCount === 1 ? "value" : "values"} for ${skippedValueKeys.size} ${skippedValueKeys.size === 1 ? "field" : "fields"} (${summary([...skippedValueKeys], 3)})`,
                {
                    variant: "warning",
                    durationMs: TOAST_DURATION,
                }
            )
        }

        await framer.closePlugin(text ?? "Successfully imported collection", {
            variant: "success",
        })
    }

    if (importing) {
        return null
    }

    if (result && itemsWithConflict.length > 0) {
        return <ManageConflicts records={itemsWithConflict} onDone={items => handleImportDone({ ...result, items })} />
    }

    return (
        <form ref={form} className="import-collection" onSubmit={handleSubmit}>
            <div className="dropzone">
                <input
                    id="file-input"
                    type="file"
                    name="file"
                    className="file-input"
                    accept=".csv"
                    required
                    onChange={handleFileChange}
                />
                <ImportIcon />
                <p className="dropzone-text">{fileName ?? "Drag and drop a CSV file here"}</p>
            </div>

            <ol className="ordered-list">
                <li>
                    <a href={importGuideURL} target="_blank" rel="noopener noreferrer">
                        Read the guide
                    </a>{" "}
                    and prepare your data
                </li>
                <li>Set up your collection fields in Framer to match the names of your CSV fields</li>
                <li>Upload your CSV</li>
            </ol>

            <footer className="footer">
                {!wasStartedInACollection && (
                    <select
                        onChange={event => setSelectedCollectionId(event.currentTarget.value)}
                        className={!selectedCollectionId ? "footer-select footer-select--unselected" : "footer-select"}
                        value={selectedCollectionId ?? ""}
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

                <div className="footer-actions">
                    <button
                        disabled={!selectedCollectionId}
                        onClick={event => {
                            if (fileName) return

                            event.preventDefault()
                            inputOpenedFromImportButton.current = true

                            const input = document.getElementById("file-input") as HTMLInputElement
                            input.click()
                        }}
                    >
                        Import
                    </button>
                </div>
            </footer>
        </form>
    )
}

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

/** Helper to show a summary of items, truncating after `max` */
function summary(items: string[], max: number) {
    const summaryFormatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" })

    if (items.length === 0) {
        return "none"
    }
    // Go one past the max, because we’ll add a sentinel anyway
    if (items.length > max + 1) {
        items = items.slice(0, max).concat([`${items.length - max} more`])
    }
    return summaryFormatter.format(items)
}
