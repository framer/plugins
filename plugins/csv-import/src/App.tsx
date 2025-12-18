import type { Collection } from "framer-plugin"
import { FramerPluginClosedError, framer, useIsAllowedTo } from "framer-plugin"
import { useCallback, useState } from "react"
import type { ImportResultItem } from "./utils/csv"
import "./App.css"
import { useMiniRouter } from "./minirouter"
import { FieldMapper, type FieldMappingItem, type MissingFieldItem } from "./routes/FieldMapper"
import { Home } from "./routes/Home"
import { ManageConflicts } from "./routes/ManageConflicts"
import { ImportError, importCSV, parseCSV, processRecordsWithFieldMapping } from "./utils/csv"
import type { FieldReconciliationItem } from "./utils/fieldReconciliation"
import { reconcileFields } from "./utils/fieldReconciliation"
import { inferFieldsFromCSV } from "./utils/typeInference"

/**
 * Convert FieldMappingItem to FieldReconciliationItem for the reconcileFields function
 */
function convertToReconciliation(
    mappings: FieldMappingItem[],
    existingFields: { id: string; name: string; type: string }[]
): FieldReconciliationItem[] {
    const items: FieldReconciliationItem[] = []

    for (const mapping of mappings) {
        switch (mapping.action) {
            case "ignore": {
                // Ignored fields are not included in reconciliation
                continue
            }
            case "create": {
                items.push({
                    inferredField: mapping.inferredField,
                    action: "add",
                })
                break
            }
            case "map": {
                if (mapping.targetFieldId) {
                    const existingField = existingFields.find(f => f.id === mapping.targetFieldId)
                    if (existingField) {
                        items.push({
                            inferredField: mapping.inferredField,
                            existingField: existingField as FieldReconciliationItem["existingField"],
                            action: mapping.hasTypeMismatch ? "keep" : "keep",
                            mapToFieldId: mapping.targetFieldId,
                        })
                    }
                }
                break
            }
            default: {
                // Exhaustive switch typecheck
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                throw new Error(`Unknown mapping action: ${(mapping).action satisfies never}`)
            }
        }
    }

    return items
}

export function App({ initialCollection }: { initialCollection: Collection | null }) {
    const [collection, setCollection] = useState<Collection | null>(initialCollection)
    const isAllowedToAddItems = useIsAllowedTo("Collection.addItems")
    const isAllowedToAddFields = useIsAllowedTo("Collection.addFields")
    const isAllowedToRemoveFields = useIsAllowedTo("Collection.removeFields")
    const hasAllPermissions = isAllowedToAddItems && isAllowedToAddFields && isAllowedToRemoveFields

    const { currentRoute, navigate } = useMiniRouter()

    const handleFileSelected = useCallback(
        async (csvContent: string) => {
            if (!collection) return
            if (!hasAllPermissions) return

            try {
                const records = await parseCSV(csvContent)
                if (records.length === 0) {
                    throw new Error("No records found in CSV")
                }

                // Infer field types from CSV data
                const fields = inferFieldsFromCSV(records)

                await navigate({
                    uid: "field-mapper",
                    opts: { collection, csvRecords: records, inferredFields: fields },
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
        [collection, hasAllPermissions, navigate]
    )

    const handleFieldMapperSubmit = useCallback(
        async (opts: {
            collection: Collection
            csvRecords: Record<string, string>[]
            mappings: FieldMappingItem[]
            slugFieldName: string
            missingFields: MissingFieldItem[]
        }) => {
            if (!hasAllPermissions) return

            try {
                // Get existing fields to convert mappings
                const existingFields = await opts.collection.getFields()

                // Convert mappings to reconciliation format
                const reconciliation = convertToReconciliation(opts.mappings, existingFields)

                // Get the set of ignored field names
                const ignoredFieldNames = new Set(
                    opts.mappings.filter(m => m.action === "ignore").map(m => m.inferredField.columnName)
                )

                // Get the list of inferred fields (excluding ignored ones)
                const inferredFields = opts.mappings.filter(m => m.action !== "ignore").map(m => m.inferredField)

                // Remove fields that the user marked for removal
                const fieldsToRemove = opts.missingFields.filter(m => m.action === "remove").map(m => m.field.id)
                if (fieldsToRemove.length > 0) {
                    await opts.collection.removeFields(fieldsToRemove)
                }

                // Apply field reconciliation changes (add new fields)
                await reconcileFields(opts.collection, reconciliation)

                // Process records with field mapping
                const result = await processRecordsWithFieldMapping({
                    collection: opts.collection,
                    csvRecords: opts.csvRecords,
                    inferredFields,
                    ignoredFieldNames,
                    slugFieldName: opts.slugFieldName,
                    reconciliation,
                })

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

                await importCSV(opts.collection, result)

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
        [hasAllPermissions, navigate]
    )

    switch (currentRoute.uid) {
        case "home": {
            return (
                <Home collection={collection} onCollectionChange={setCollection} onFileSelected={handleFileSelected} />
            )
        }
        case "field-mapper":
            return (
                <FieldMapper
                    collection={currentRoute.opts.collection}
                    inferredFields={currentRoute.opts.inferredFields}
                    csvRecords={currentRoute.opts.csvRecords}
                    onSubmit={opts =>
                        handleFieldMapperSubmit({
                            collection: currentRoute.opts.collection,
                            csvRecords: currentRoute.opts.csvRecords,
                            mappings: opts.mappings,
                            slugFieldName: opts.slugFieldName,
                            missingFields: opts.missingFields,
                        })
                    }
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
