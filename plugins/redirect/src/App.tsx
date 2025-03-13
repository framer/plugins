import type { Collection, Redirect } from "framer-plugin"

import "./App.css"
import { framer } from "framer-plugin"
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { processRecords, parseCSV, importCSV, type ImportResult, type ImportResultItem, exportCSV } from "./csv"

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

export const IconChevron = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="16" className={className}>
        <path
            d="M 3 11 L 6 8 L 3 5"
            fill="transparent"
            strokeWidth="1.5"
            stroke="#999"
            strokeLinecap="round"
            strokeLinejoin="round"
        ></path>
    </svg>
)

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
            if (existingRecord.from === record.from) {
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
                    <span style={{ color: "var(--framer-color-text)", fontWeight: 600 }}>“{currentRecord.from}”</span>
                    <p>A redirect with this path already exists.</p>
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

            <div className="actions-row">
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

function Import({ onManageConflicts }: { onManageConflicts: () => void }) {
    const form = useRef<HTMLFormElement>(null)
    const inputOpenedFromImportButton = useRef(false)

    const [result, setResult] = useState<ImportResult | null>(null)

    const itemsWithConflict = useMemo(() => result?.items.filter(item => item.action === "conflict") ?? [], [result])

    const [isDragging, setIsDragging] = useState(false)

    useEffect(() => {
        if (itemsWithConflict.length === 0) {
            return
        }

        framer.showUI({
            width: 260,
            height: 145,
            resizable: false,
        })

        onManageConflicts()
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
                framer.notify("No records found in CSV", {
                    variant: "error",
                })
                return
            }

            const result = await processRecords(csvRecords)
            setResult(result)

            if (result.items.some(item => item.action === "conflict")) {
                onManageConflicts()
                return
            }

            await importItems(result)
        } catch (error) {
            console.error(error)
            framer.notify("Error processing CSV file. Check console for details.", {
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
        await importCSV(result)
    }

    if (result && itemsWithConflict.length > 0) {
        return (
            <ManageConflicts
                records={itemsWithConflict}
                onAllConflictsResolved={resolvedItems => {
                    const updatedItems = result.items.map(item => {
                        const resolvedItem = resolvedItems.find(resolved => resolved.from === item.from)
                        return resolvedItem || item
                    })
                    importItems({ ...result, items: updatedItems })
                }}
            />
        )
    }

    return (
        <form ref={form} className="import-redirects" onSubmit={handleSubmit}>
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
                    <div className="intro">
                        <div className="logo">
                            <ImportIcon />
                        </div>
                        <div className="content">
                            <h2>Upload CSV</h2>
                            <p>Make sure your collection fields in Framer match the names of your CSV fields.</p>
                        </div>
                    </div>

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

function RedirectList({ redirects }: { redirects: readonly Redirect[] }) {
    return (
        <div className="redirect-list">
            {redirects.length === 0 && (
                <div className="empty">
                    <p>No redirects found</p>
                </div>
            )}

            {redirects.map(redirect => (
                <div key={redirect.from} className="redirect-row">
                    <p className="redirect-row-from" title={redirect.from}>
                        {redirect.from}
                    </p>
                    <IconChevron className="redirect-row-chevron" />
                    <p className="redirect-row-to" title={redirect.to}>
                        {redirect.to}
                    </p>
                </div>
            ))}
        </div>
    )
}

function ExportOrRemove() {
    const [filter, setFilter] = useState<string>("")
    const [redirects, setRedirects] = useState<readonly Redirect[]>([])
    const filteredRedirects = useMemo(() => {
        return redirects.filter(redirect => redirect.from.toLowerCase().startsWith(filter))
    }, [redirects, filter])

    const fetchRedirects = useCallback(async () => {
        const redirects = await framer.unstable_getRedirects()
        setRedirects(redirects)
    }, [])

    useEffect(() => {
        fetchRedirects()
    }, [])

    const [isExporting, setIsExporting] = useState(false)
    const [isRemoving, setIsRemoving] = useState(false)

    const disabled = filteredRedirects.length === 0 || isExporting || isRemoving

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            setIsExporting(true)
            const projectInfo = await framer.getProjectInfo()
            exportCSV(filteredRedirects, `${projectInfo.name} Redirects.csv`)
            await fetchRedirects()
            setIsExporting(false)
        },
        [filteredRedirects, fetchRedirects]
    )

    const handleRemove = useCallback(async () => {
        setIsRemoving(true)
        await framer.unstable_removeRedirects(filteredRedirects.map(redirect => redirect.id))
        await fetchRedirects()
        setIsRemoving(false)
    }, [filteredRedirects, fetchRedirects])

    return (
        <form className="export-redirects" onSubmit={handleSubmit}>
            <RedirectList redirects={filteredRedirects} />

            <div className="actions">
                <input
                    type="text"
                    value={filter}
                    onChange={event => setFilter(event.target.value)}
                    disabled={redirects.length === 0 || isExporting || isRemoving}
                    placeholder="Filter redirects by path"
                    autoFocus
                />

                <div className="actions-row">
                    <button
                        type="button"
                        className="framer-button-secondary"
                        onClick={() => handleRemove()}
                        disabled={disabled}
                    >
                        {isRemoving ? <div className="framer-spinner" /> : `Remove`}
                    </button>
                    <button type="submit" className="framer-button-primary" disabled={disabled}>
                        {isExporting ? <div className="framer-spinner" /> : `Export`}
                    </button>
                </div>
            </div>
        </form>
    )
}

export function App() {
    const [tab, setTab] = useState<"import" | "manage-conflicts" | "export-or-remove">("import")

    useEffect(() => {
        if (tab === "manage-conflicts") {
            return
        }

        framer.showUI({
            width: 260,
            minWidth: 260,
            height: 500,
            resizable: "width",
        })
    }, [])

    return (
        <main>
            {tab !== "manage-conflicts" && (
                <>
                    <hr className="sticky-divider" />
                    <div className="tabs">
                        <button data-active={tab === "import"} onClick={() => setTab("import")}>
                            Import
                        </button>
                        <button data-active={tab === "export-or-remove"} onClick={() => setTab("export-or-remove")}>
                            Export
                        </button>
                    </div>
                    <hr className="sticky-divider" />
                </>
            )}
            {(tab === "import" || tab === "manage-conflicts") && (
                <Import onManageConflicts={() => setTab("manage-conflicts")} />
            )}
            {tab === "export-or-remove" && <ExportOrRemove />}
        </main>
    )
}
