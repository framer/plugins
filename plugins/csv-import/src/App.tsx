import type { Collection } from "framer-plugin"
import { FramerPluginClosedError, framer, useIsAllowedTo } from "framer-plugin"
import { useCallback, useState } from "react"
import type { ImportResultItem } from "./utils/csv"
import "./App.css"
import { useMiniRouter } from "./minirouter"
import { FieldMapping } from "./routes/FieldMapping"
import { FieldReconciliation, type FieldReconciliationItem } from "./routes/FieldReconciliation"
import { Home } from "./routes/Home"
import { ManageConflicts } from "./routes/ManageConflicts"
import { ImportError, importCSV, parseCSV, processRecordsWithFieldMapping } from "./utils/csv"
import { reconcileFields } from "./utils/fieldReconciliation"
import type { InferredField } from "./utils/typeInference"
import { inferFieldsFromCSV } from "./utils/typeInference"

export function App({ initialCollection }: { initialCollection: Collection | null }) {
    const [collection, setCollection] = useState<Collection | null>(initialCollection)
    const isAllowedToAddItems = useIsAllowedTo("Collection.addItems")

    const { currentRoute, navigate } = useMiniRouter()

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

                await navigate({ uid: "field-mapping", opts: { csvRecords: records, inferredFields: fields } })
            } catch (error) {
                if (error instanceof FramerPluginClosedError) {
                    throw error
                }

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
        [collection, isAllowedToAddItems, navigate]
    )

    const handleFieldMappingSubmit = useCallback(
        async (opts: {
            csvRecords: Record<string, string>[]
            fields: InferredField[]
            ignoredFieldNames: Set<string>
            slugFieldName: string
        }) => {
            if (!collection) return
            if (!isAllowedToAddItems) return

            try {
                // Navigate to field reconciliation step
                await navigate({
                    uid: "field-reconciliation",
                    opts: {
                        collection,
                        csvRecords: opts.csvRecords,
                        inferredFields: opts.fields.filter(f => !opts.ignoredFieldNames.has(f.columnName)),
                        onSubmit: async (reconciliation: FieldReconciliationItem[]) => {
                            await handleFieldReconciliationSubmit({
                                csvRecords: opts.csvRecords,
                                fields: opts.fields,
                                ignoredFieldNames: opts.ignoredFieldNames,
                                slugFieldName: opts.slugFieldName,
                                reconciliation,
                            })
                        },
                    },
                })
            } catch (error) {
                if (error instanceof FramerPluginClosedError) {
                    throw error
                }

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
        [collection, isAllowedToAddItems, navigate]
    )

    const handleFieldReconciliationSubmit = useCallback(
        async (opts: {
            csvRecords: Record<string, string>[]
            fields: InferredField[]
            ignoredFieldNames: Set<string>
            slugFieldName: string
            reconciliation: FieldReconciliationItem[]
        }) => {
            if (!collection) return
            if (!isAllowedToAddItems) return

            try {
                // Apply field reconciliation changes
                await reconcileFields(collection, opts.reconciliation)

                // Process records with field mapping
                const result = await processRecordsWithFieldMapping(
                    collection,
                    opts.csvRecords,
                    opts.fields,
                    opts.ignoredFieldNames,
                    opts.slugFieldName,
                    opts.reconciliation
                )

                const itemsWithConflict = result.items.filter(item => item.action === "conflict")
                if (itemsWithConflict.length > 0) {
                    const resolutions = await new Promise<ImportResultItem[]>(resolve => {
                        void navigate({
                            uid: "manage-conflicts",
                            opts: {
                                conflicts: itemsWithConflict,
                                result,
                                onComplete(items) {
                                    resolve(items)
                                },
                            },
                        })
                    })

                    result.items = result.items.map(
                        item => resolutions.find(resolved => resolved.slug === item.slug) ?? item
                    )
                }

                await importCSV(collection, result)

                await framer.hideUI()
            } catch (error) {
                if (error instanceof FramerPluginClosedError) {
                    throw error
                }

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
        [collection, isAllowedToAddItems, navigate]
    )

    switch (currentRoute.uid) {
        case "home": {
            return (
                <Home collection={collection} onCollectionChange={setCollection} onFileSelected={handleFileSelected} />
            )
        }
        case "field-mapping":
            return (
                <FieldMapping
                    inferredFields={currentRoute.opts.inferredFields}
                    csvRecords={currentRoute.opts.csvRecords}
                    onSubmit={(fields, ignoredFieldNames, slugFieldName) =>
                        handleFieldMappingSubmit({
                            csvRecords: currentRoute.opts.csvRecords,
                            fields,
                            ignoredFieldNames,
                            slugFieldName,
                        })
                    }
                    onCancel={async () => {
                        await navigate({ uid: "home", opts: undefined })
                    }}
                />
            )
        case "field-reconciliation":
            return (
                <FieldReconciliation
                    collection={currentRoute.opts.collection}
                    inferredFields={currentRoute.opts.inferredFields}
                    csvRecords={currentRoute.opts.csvRecords}
                    onSubmit={currentRoute.opts.onSubmit}
                    onCancel={async () => {
                        await navigate({ uid: "home", opts: undefined })
                    }}
                />
            )
        case "manage-conflicts": {
            return (
                <ManageConflicts
                    records={currentRoute.opts.conflicts}
                    onAllConflictsResolved={currentRoute.opts.onComplete}
                />
            )
        }
        default:
            // @ts-expect-error -- exhaustive switch
            return <div>Unknown route {currentRoute.uid}</div>
    }
}
