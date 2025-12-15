import type { Collection } from "framer-plugin"
import { FramerPluginClosedError, framer, useIsAllowedTo } from "framer-plugin"
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ImportResult } from "./csv"
import "./App.css"
import { CreateCollectionDialog } from "./CreateCollectionDialog"
import { ImportError, importCSV, parseCSV, processRecords } from "./csv"
import { ImportIcon } from "./ImportIcon"
import { ManageConflicts } from "./ManageConflicts"
import { PlusIcon } from "./PlusIcon"

export function App({ collection: initialCollection }: { collection: Collection | null }) {
    const [collection, setCollection] = useState<Collection | null>(initialCollection)
    const [collections, setCollections] = useState<Collection[]>([])
    const [showCreateCollectionDialog, setShowCreateCollectionDialog] = useState(false)

    const isAllowedToAddItems = useIsAllowedTo("Collection.addItems")
    const isAllowedToCreateCollection = useIsAllowedTo("createCollection")

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
    }, [])

    useEffect(() => {
        const abortController = new AbortController()

        const task = async () => {
            try {
                const collections = await framer.getCollections()

                // Check if component was unmounted before setting state
                if (abortController.signal.aborted) return

                const writableCollections = collections.filter(collection => collection.managedBy === "user")
                setCollections(writableCollections)
            } catch (error) {
                // Only handle error if component is still mounted
                if (abortController.signal.aborted) return

                console.error(error)
                framer.notify("Failed to load collections", { variant: "error" })
            }
        }

        void task()

        return () => {
            abortController.abort()
        }
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
            if (!collection) return

            await framer.hideUI()
            await importCSV(collection, result)
        },
        [collection]
    )

    const processAndImport = useCallback(
        async (csv: string) => {
            if (!collection) return
            if (!isAllowedToAddItems) return

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
                if (error instanceof FramerPluginClosedError) throw error

                console.error(error)

                if (error instanceof ImportError || error instanceof Error) {
                    framer.notify(error.message, { variant: "error" })
                    return
                }

                framer.closePlugin("Error processing CSV file. Check console for details.", {
                    variant: "error",
                })
            }
        },
        [isAllowedToAddItems, collection, importItems]
    )

    useEffect(() => {
        if (!collection) return
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
    }, [isAllowedToAddItems, collection])

    useEffect(() => {
        if (!collection) return
        if (!isAllowedToAddItems) return
        if (showCreateCollectionDialog) return

        const handlePaste = ({ clipboardData }: ClipboardEvent) => {
            if (!clipboardData) return

            const task = async () => {
                let csv = ""

                try {
                    csv = clipboardData.getData("text/plain")
                    if (!csv) return
                } catch (error) {
                    console.error("Error accessing clipboard data:", error)
                    framer.notify("Unable to access clipboard content", {
                        variant: "error",
                    })
                    return
                }

                try {
                    await processAndImport(csv)
                } catch (error) {
                    if (error instanceof FramerPluginClosedError) return

                    console.error("Error importing CSV:", error)
                    framer.notify("Error importing CSV", {
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
    }, [isAllowedToAddItems, processAndImport, collection, showCreateCollectionDialog])

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            if (!collection) return
            if (!isAllowedToAddItems) return
            event.preventDefault()

            if (!form.current) throw new Error("Form ref not set")

            const formData = new FormData(form.current)
            const fileValue = formData.get("file")

            if (!fileValue || typeof fileValue === "string") return

            const file = fileValue

            void file.text().then(processAndImport)
        },
        [isAllowedToAddItems, processAndImport, collection]
    )

    const handleFileChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            if (!collection) return
            if (!event.currentTarget.files?.[0]) return
            if (inputOpenedFromImportButton.current) {
                form.current?.requestSubmit()
            }
        },
        [collection]
    )

    const selectCollection = async (event: ChangeEvent<HTMLSelectElement>) => {
        const collection = collections.find(collection => collection.id === event.currentTarget.value)
        if (!collection) return

        await collection.setAsActive()
        setCollection(collection)
    }

    const createNewCollection = useCallback(async (name: string) => {
        const newCollection = await framer.createCollection(name)

        await newCollection.setAsActive()
        setCollection(newCollection)
    }, [])

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
        <>
            <form ref={form} className="import-collection" onSubmit={handleSubmit}>
                {/* Show collection selector at the top if opened without a collection already selected */}
                {
                    <div className="collection-selector">
                        <select
                            className="collection-select"
                            value={collection?.id ?? ""}
                            onChange={e => void selectCollection(e)}
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
                        {isAllowedToCreateCollection && (
                            <button
                                type="button"
                                className="create-collection-button"
                                onClick={() => {
                                    setShowCreateCollectionDialog(true)
                                }}
                                title="Create new collection"
                            >
                                <PlusIcon />
                            </button>
                        )}
                    </div>
                }

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

                        <button
                            className="framer-button-primary"
                            onClick={event => {
                                event.preventDefault()
                                inputOpenedFromImportButton.current = true

                                const input = document.getElementById("file-input") as HTMLInputElement
                                input.click()
                            }}
                            disabled={!isAllowedToAddItems || !collection}
                            title={isAllowedToAddItems ? undefined : "Insufficient permissions"}
                        >
                            Upload File
                        </button>
                    </>
                )}
            </form>

            {showCreateCollectionDialog && (
                <CreateCollectionDialog
                    onCancel={() => {
                        setShowCreateCollectionDialog(false)
                    }}
                    onSubmit={async name => {
                        await createNewCollection(name)
                        setShowCreateCollectionDialog(false)
                    }}
                />
            )}
        </>
    )
}
