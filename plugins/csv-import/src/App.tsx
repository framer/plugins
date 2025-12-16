import type { Collection } from "framer-plugin"
import { FramerPluginClosedError, framer, useIsAllowedTo } from "framer-plugin"
import { useCallback, useState } from "react"
import type { ImportResult } from "./csv"
import "./App.css"
import { CollectionSelector } from "./CollectionSelector"
import { ImportError, importCSV, parseCSV, processRecordsWithFieldMapping } from "./csv"
import { FieldMapping } from "./FieldMapping"
import { ManageConflicts } from "./ManageConflicts"
import { useMiniRouter } from "./minirouter"
import { SelectCSVFile } from "./SelectCSVFile"
import type { InferredField } from "./typeInference"
import { inferFieldsFromCSV } from "./typeInference"

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
                const result = await processRecordsWithFieldMapping(
                    collection,
                    opts.csvRecords,
                    opts.fields,
                    opts.ignoredFieldNames,
                    opts.slugFieldName
                )

                const itemsWithConflict = result.items.filter(item => item.action === "conflict")
                if (itemsWithConflict.length > 0) {
                    await navigate({ uid: "manage-conflicts", opts: { conflicts: itemsWithConflict, result } })

                    return
                } else {
                    await importCSV(collection, result)

                    await framer.hideUI()
                }
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
        [collection, isAllowedToAddItems, navigate]
    )

    const importItems = useCallback(
        async (result: ImportResult) => {
            if (!collection) return

            await framer.hideUI()
            await importCSV(collection, result)
        },
        [collection]
    )

    switch (currentRoute.uid) {
        case "home": {
            if (collection) {
                return (
                    <div className="import-collection">
                        <CollectionSelector collection={collection} onCollectionChange={setCollection} />
                        <SelectCSVFile onFileSelected={handleFileSelected} />
                    </div>
                )
            } else {
                return (
                    <div className="import-collection">
                        <CollectionSelector collection={collection} onCollectionChange={setCollection} />
                        <div className="intro no-border">
                            <p>Select a collection to import CSV data into.</p>
                        </div>
                    </div>
                )
            }
        }
        case "manage-conflicts": {
            return (
                <ManageConflicts
                    records={currentRoute.opts.conflicts}
                    onAllConflictsResolved={resolvedItems => {
                        const updatedItems = currentRoute.opts.result.items.map(
                            item => resolvedItems.find(resolved => resolved.slug === item.slug) ?? item
                        )
                        void importItems({ ...currentRoute.opts.result, items: updatedItems })
                    }}
                />
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
        default:
            // @ts-expect-error -- exhaustive switch
            return <div>Unknown route {currentRoute.uid}</div>
    }
}
