import type { Collection } from "framer-plugin"
import { FramerPluginClosedError, framer, useIsAllowedTo } from "framer-plugin"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ImportResult } from "./csv"
import "./App.css"
import { CollectionSelector } from "./CollectionSelector"
import { ImportError, importCSV, parseCSV, processRecordsWithFieldMapping } from "./csv"
import { FieldMapping } from "./FieldMapping"
import { ManageConflicts } from "./ManageConflicts"
import { SelectCSVFile } from "./SelectCSVFile"
import type { InferredField } from "./typeInference"
import { inferFieldsFromCSV } from "./typeInference"

type WorkflowStep = "select-collection" | "select-file" | "field-mapping" | "manage-conflicts"

export function App({ initialCollection }: { initialCollection: Collection | null }) {
    const [collection, setCollection] = useState<Collection | null>(initialCollection)
    const isAllowedToAddItems = useIsAllowedTo("Collection.addItems")

    const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(
        initialCollection ? "select-file" : "select-collection"
    )
    const [csvRecords, setCsvRecords] = useState<Record<string, string>[]>([])
    const [inferredFields, setInferredFields] = useState<InferredField[]>([])
    const [result, setResult] = useState<ImportResult | null>(null)

    const itemsWithConflict = useMemo(() => result?.items.filter(item => item.action === "conflict") ?? [], [result])

    useEffect(() => {
        // Adjust UI size based on workflow step
        if (workflowStep === "field-mapping") {
            void framer.showUI({
                width: 400,
                height: 600,
                resizable: true,
            })
        } else if (workflowStep === "manage-conflicts") {
            void framer.showUI({
                width: 260,
                height: 165,
                resizable: false,
            })
        } else {
            void framer.showUI({
                width: 260,
                height: 330,
                resizable: false,
            })
        }
    }, [workflowStep])

    useEffect(() => {
        // Update workflow step based on collection selection
        if (collection && workflowStep === "select-collection") {
            setWorkflowStep("select-file")
        }
    }, [collection, workflowStep])

    useEffect(() => {
        // Update workflow step when conflicts are detected
        if (itemsWithConflict.length > 0 && workflowStep !== "manage-conflicts") {
            setWorkflowStep("manage-conflicts")
        }
    }, [itemsWithConflict, workflowStep])

    const handleFileSelected = useCallback(
        async (csvContent: string) => {
            if (!collection) return
            if (!isAllowedToAddItems) return

            try {
                const records = await parseCSV(csvContent)
                if (records.length === 0) {
                    throw new Error("No records found in CSV")
                }

                // Infer field types from CSV data
                const fields = inferFieldsFromCSV(records)

                setCsvRecords(records)
                setInferredFields(fields)
                setWorkflowStep("field-mapping")
            } catch (error) {
                if (error instanceof FramerPluginClosedError) throw error

                console.error(error)

                if (error instanceof ImportError || error instanceof Error) {
                    framer.notify(error.message, { variant: "error" })
                    return
                }

                framer.notify("Error processing CSV file. Check console for details.", {
                    variant: "error",
                })
            }
        },
        [collection, isAllowedToAddItems]
    )

    const handleFieldMappingSubmit = useCallback(
        async (fields: InferredField[], ignoredFieldNames: Set<string>, slugFieldName: string) => {
            if (!collection) return
            if (!isAllowedToAddItems) return

            try {
                const result = await processRecordsWithFieldMapping(
                    collection,
                    csvRecords,
                    fields,
                    ignoredFieldNames,
                    slugFieldName
                )
                setResult(result)

                if (result.items.some(item => item.action === "conflict")) {
                    return
                }

                await framer.hideUI()
                await importCSV(collection, result)
            } catch (error) {
                if (error instanceof FramerPluginClosedError) throw error

                console.error(error)

                if (error instanceof ImportError || error instanceof Error) {
                    framer.notify(error.message, { variant: "error" })
                    return
                }

                framer.notify("Error processing CSV file. Check console for details.", {
                    variant: "error",
                })
            }
        },
        [collection, csvRecords, isAllowedToAddItems]
    )

    const importItems = useCallback(
        async (result: ImportResult) => {
            if (!collection) return

            await framer.hideUI()
            await importCSV(collection, result)
        },
        [collection]
    )

    // Handle conflicts
    if (workflowStep === "manage-conflicts" && result && itemsWithConflict.length > 0) {
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

    // Field mapping step
    if (workflowStep === "field-mapping" && collection) {
        return (
            <FieldMapping
                inferredFields={inferredFields}
                csvRecords={csvRecords}
                onSubmit={handleFieldMappingSubmit}
                onCancel={() => {
                    setWorkflowStep("select-file")
                    setCsvRecords([])
                    setInferredFields([])
                }}
            />
        )
    }

    // File selection step
    if (workflowStep === "select-file" && collection) {
        return (
            <div className="import-collection">
                <CollectionSelector collection={collection} onCollectionChange={setCollection} />
                <SelectCSVFile onFileSelected={handleFileSelected} />
            </div>
        )
    }

    // Collection selection step
    return (
        <div className="import-collection">
            <CollectionSelector collection={collection} onCollectionChange={setCollection} />
            <div className="intro">
                <p>Select a collection to import CSV data into.</p>
            </div>
        </div>
    )
}
